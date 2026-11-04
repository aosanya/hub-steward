package http

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"reflect"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaactor "wakalaserver/modules/actor"
	actorroutes "wakalaserver/modules/actor/routes"
	mwanachamacomm "wakalaserver/modules/comm"
	commroutes "wakalaserver/modules/comm/routes"

	"wakalaserver/internal/agencies"
)

type actorToolShape struct{ mwanachamaactor.UserManager }

const memberSearchArgument = "q"

func (d *Deps) registerActorCommMCPTools(server *mcp.Server) {
	if d.Registry == nil {
		return
	}
	for _, t := range actorroutes.ToolsFor(actorToolShape{}, actorroutes.Mount{}) {
		server.AddTool(&mcp.Tool{
			Name:        t.Name,
			Title:       t.Title,
			Description: t.Description,
			InputSchema: withMemberSearchArgument(t.Action, withAgencyInstance(t.Name, t.InputSchema, "The agency whose people and groups this call reads or writes.")),
		}, d.actorCommToolHandler(t.Name, t.Action, d.invokeActorTool))
	}
	chat, err := commroutes.BuildChatTools((*mwanachamacomm.CommManager)(nil), commroutes.Mount{})
	if err != nil {
		panic(fmt.Sprintf("comm mcp: %v", err))
	}
	for _, t := range chat {
		server.AddTool(&mcp.Tool{
			Name:        t.Name,
			Title:       t.Title,
			Description: t.Description,
			InputSchema: withAgencyInstance(t.Name, t.InputSchema, "The agency whose chat rooms this call reads or writes."),
		}, d.actorCommToolHandler(t.Name, t.Action, d.invokeChatTool))
	}
}

func withMemberSearchArgument(action string, schema map[string]any) map[string]any {
	if action != listActors {
		return schema
	}
	props, _ := schema["properties"].(map[string]any)
	props[memberSearchArgument] = map[string]any{"type": "string", "description": "Keep only people whose name or code contains this text."}
	return schema
}

type actorCommInvoker func(ctx context.Context, name, action, instanceID string, args map[string]json.RawMessage) (any, error)

func (d *Deps) actorCommToolHandler(name, action string, invoke actorCommInvoker) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		instanceID, args, err := splitInstanceArguments(req.Params.Arguments)
		if err != nil {
			return toolError(err), nil
		}
		out, err := invoke(ctx, name, action, instanceID, args)
		if err != nil {
			return toolError(err), nil
		}
		return toolResult(name, out), nil
	}
}

func splitInstanceArguments(raw json.RawMessage) (string, map[string]json.RawMessage, error) {
	instanceID, rest, err := splitFormsInstance(raw)
	if err != nil {
		return "", nil, err
	}
	args := map[string]json.RawMessage{}
	if err := json.Unmarshal(rest, &args); err != nil {
		return "", nil, err
	}
	return instanceID, args, nil
}

func toolResult(name string, out any) *mcp.CallToolResult {
	rv := reflect.ValueOf(out)
	if out == nil || (rv.IsValid() && (rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array)) {
		count := 0
		if rv.IsValid() {
			count = rv.Len()
		}
		if out == nil {
			out = []any{}
		}
		return &mcp.CallToolResult{
			Content:           []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("Found %d item(s)", count)}},
			StructuredContent: map[string]any{"items": out},
		}
	}
	return &mcp.CallToolResult{
		Content:           []mcp.Content{&mcp.TextContent{Text: name + " completed"}},
		StructuredContent: out,
	}
}

func (d *Deps) invokeActorTool(ctx context.Context, name, action, instanceID string, args map[string]json.RawMessage) (any, error) {
	m, role, err := actorManagerFor(ctx, d.Registry, instanceID)
	if err != nil {
		return nil, err
	}
	ctx = context.WithValue(ctx, partitionKey{}, instanceID)
	mount := d.actorMount(role)
	if mount.Authorize != nil && mount.Authorize(ctx, action) != nil {
		return nil, agencies.ErrInstanceNotFound
	}
	mount.Authorize = nil
	stub := toolRequest(ctx, instanceID, args)
	if role == agencies.RoleResident {
		if err := residentLeadsTheGroupNamed(stub, m, action); err != nil {
			return nil, err
		}
	}
	announced := withheldFromMembers(quietDeclinesUnseen{joinDecisionsAnnounced{UserManager: m, rooms: d.Registry, instanceID: instanceID, rules: d.NotifyRules, agency: d.Registry}}, action)
	tools, err := actorroutes.BuildToolsFor(announced, mount)
	if err != nil {
		return nil, err
	}
	out, err := invokeNamed(ctx, tools, name, withoutMemberSearch(action, args))
	if err != nil {
		return nil, err
	}
	return d.rewrittenToolRows(stub, action, out)
}

func (d *Deps) invokeChatTool(ctx context.Context, name, action, instanceID string, args map[string]json.RawMessage) (any, error) {
	cm, role, err := commManagerFor(ctx, d.Registry, instanceID, action)
	if err != nil {
		return nil, err
	}
	ctx = context.WithValue(ctx, partitionKey{}, instanceID)
	mount := d.instanceCommMount(role)
	if mount.Authorize != nil && mount.Authorize(ctx, action) != nil {
		return nil, agencies.ErrInstanceNotFound
	}
	mount.Authorize = nil
	stub := toolRequest(ctx, instanceID, args)
	if err := openGeneralOnRead(stub, d.Registry, mount, action); err != nil {
		return nil, err
	}
	tools, err := commroutes.BuildChatTools(cm, mount)
	if err != nil {
		return nil, err
	}
	out, err := invokeNamed(ctx, tools, name, args)
	if err != nil {
		return nil, err
	}
	return d.rewrittenToolRows(stub, action, out)
}

func invokeNamed(ctx context.Context, tools []actorroutes.Tool, name string, args map[string]json.RawMessage) (any, error) {
	raw, err := json.Marshal(args)
	if err != nil {
		return nil, err
	}
	for _, t := range tools {
		if t.Name == name {
			return t.Invoke(ctx, raw)
		}
	}
	return nil, fmt.Errorf("unknown tool %s", name)
}

func withoutMemberSearch(action string, args map[string]json.RawMessage) map[string]json.RawMessage {
	if action != listActors {
		return args
	}
	kept := make(map[string]json.RawMessage, len(args))
	for k, v := range args {
		if k != memberSearchArgument {
			kept[k] = v
		}
	}
	return kept
}

func toolRequest(ctx context.Context, instanceID string, args map[string]json.RawMessage) *http.Request {
	r, _ := http.NewRequestWithContext(ctx, http.MethodGet, "/", nil)
	r.SetPathValue("instanceID", instanceID)
	query := url.Values{}
	for key, raw := range args {
		var text string
		if json.Unmarshal(raw, &text) == nil {
			r.SetPathValue(key, text)
			query.Set(key, text)
		}
	}
	r.URL.RawQuery = query.Encode()
	return r
}

func (d *Deps) rewrittenToolRows(stub *http.Request, action string, out any) (any, error) {
	var rewrites []rowRewrite
	for _, rewrite := range []rowRewrite{
		authorRolesRewrite(d.Registry, action),
		screenNamesRewrite(d.Registry, action),
		invitedGroupNamesRewrite(d.Registry, action),
		memberSearchRewrite(action, stub),
	} {
		if rewrite != nil {
			rewrites = append(rewrites, rewrite)
		}
	}
	if len(rewrites) == 0 {
		return out, nil
	}
	raw, err := json.Marshal(out)
	if err != nil {
		return nil, err
	}
	var rows []map[string]json.RawMessage
	if err := json.Unmarshal(raw, &rows); err != nil {
		return out, nil
	}
	for _, rewrite := range rewrites {
		if rows, err = rewrite(stub, rows); err != nil {
			return nil, err
		}
	}
	return rows, nil
}
