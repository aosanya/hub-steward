package http

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"slices"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamacustody "wakalaserver/modules/custody"
	custodyroutes "wakalaserver/modules/custody/routes"
	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
)

var consentLanguageActions = []string{
	"custody.consent.give",
	"custody.consent_version.list",
	"custody.consent_text.read",
	"custody.consent_text.publish",
}

func custodyShapeTools() []custodyroutes.Tool {
	tools, err := custodyroutes.BuildTools((*mwanachamacustody.CustodyManager)(nil), custodyroutes.Mount{})
	if err != nil {
		panic(fmt.Sprintf("custody mcp: %v", err))
	}
	return tools
}

func custodyToolActions() map[string]string {
	out := map[string]string{}
	for _, t := range custodyShapeTools() {
		out[t.Name] = t.Action
	}
	return out
}

func (d *Deps) registerCustodyMCPTools(server *mcp.Server) {
	if d.Registry == nil {
		return
	}
	for _, t := range custodyShapeTools() {
		server.AddTool(&mcp.Tool{
			Name:        t.Name,
			Title:       t.Title,
			Description: t.Description,
			InputSchema: withAgencyInstance(t.Name, t.InputSchema, "The agency whose consent text this call reads or writes."),
		}, d.custodyToolHandler(t.Name, t.Action))
	}
}

func (d *Deps) custodyToolHandler(name, action string) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		out, err := d.invokeCustodyTool(ctx, name, action, req.Params.Arguments)
		if err != nil {
			return toolError(err), nil
		}
		rv := reflect.ValueOf(out)
		if rv.IsValid() && (rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array) {
			return &mcp.CallToolResult{
				Content:           []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf("Found %d item(s)", rv.Len())}},
				StructuredContent: map[string]any{"items": out},
			}, nil
		}
		return &mcp.CallToolResult{
			Content:           []mcp.Content{&mcp.TextContent{Text: name + " completed"}},
			StructuredContent: out,
		}, nil
	}
}

func (d *Deps) invokeCustodyTool(ctx context.Context, name, action string, raw json.RawMessage) (any, error) {
	instanceID, rest, err := splitFormsInstance(raw)
	if err != nil {
		return nil, err
	}
	cm, err := custodyManagerFor(ctx, d.Registry, instanceID, action)
	if err != nil {
		return nil, err
	}
	role, err := d.Registry.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
	if err != nil {
		return nil, err
	}
	ctx = context.WithValue(ctx, partitionKey{}, instanceID)
	mount := d.instanceCustodyMount(role)
	if mount.Authorize != nil && mount.Authorize(ctx, action) != nil {
		return nil, dispatch.ErrForbidden
	}
	mount.Authorize = nil
	if slices.Contains(consentLanguageActions, action) {
		rest = d.withAgencyConsentLanguageArgument(ctx, instanceID, rest)
	}
	tools, err := custodyroutes.BuildTools(cm, mount)
	if err != nil {
		return nil, err
	}
	for _, t := range tools {
		if t.Name == name {
			return t.Invoke(ctx, rest)
		}
	}
	return nil, fmt.Errorf("unknown tool %s", name)
}

func (d *Deps) withAgencyConsentLanguageArgument(ctx context.Context, instanceID string, raw json.RawMessage) json.RawMessage {
	args := map[string]json.RawMessage{}
	if len(raw) > 0 && json.Unmarshal(raw, &args) != nil {
		return raw
	}
	var named string
	_ = json.Unmarshal(args["language"], &named)
	if named != "" {
		return raw
	}
	language, ok := d.agencyConsentLanguage(ctx, instanceID)
	if !ok {
		return raw
	}
	quoted, err := json.Marshal(language)
	if err != nil {
		return raw
	}
	args["language"] = quoted
	filled, err := json.Marshal(args)
	if err != nil {
		return raw
	}
	return filled
}
