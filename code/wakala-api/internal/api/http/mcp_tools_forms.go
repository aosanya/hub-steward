package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	forms "wakalaserver/modules/forms"
	formsroutes "wakalaserver/modules/forms/routes"

	"wakalaserver/internal/agencies"
)

var errFormsInstanceRequired = errors.New("instance_id is required")

type formsToolShape struct{ forms.FormManager }

func (d *Deps) registerFormsMCPTools(server *mcp.Server) {
	if d.Registry == nil {
		return
	}
	shape, err := formsroutes.BuildGatedTools(formsToolShape{}, formsroutes.Mount{})
	if err != nil {
		panic(fmt.Sprintf("forms mcp: %v", err))
	}
	for _, t := range shape {
		server.AddTool(&mcp.Tool{
			Name:        t.Name,
			Title:       t.Title,
			Description: t.Description,
			InputSchema: withAgencyInstance(t.Name, t.InputSchema, "The agency whose forms this call reads or writes."),
		}, d.formsToolHandler(t.Name, t.Action))
	}
}

func withAgencyInstance(name string, raw json.RawMessage, purpose string) map[string]any {
	schema := map[string]any{}
	if err := json.Unmarshal(raw, &schema); err != nil {
		panic(fmt.Sprintf("mcp: %s input schema: %v", name, err))
	}
	props, _ := schema["properties"].(map[string]any)
	if props == nil {
		props = map[string]any{}
	}
	props["instance_id"] = map[string]any{"type": "string", "description": purpose}
	schema["properties"] = props
	required, _ := schema["required"].([]any)
	schema["required"] = append(required, "instance_id")
	schema["type"] = "object"
	return schema
}

func (d *Deps) formsToolHandler(name, action string) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		out, err := d.invokeFormsTool(ctx, name, action, req.Params.Arguments)
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

func (d *Deps) invokeFormsTool(ctx context.Context, name, action string, raw json.RawMessage) (any, error) {
	instanceID, rest, err := splitFormsInstance(raw)
	if err != nil {
		return nil, err
	}
	fm, role, err := formsManagerFor(ctx, d.Registry, instanceID)
	if err != nil {
		return nil, err
	}
	ctx = context.WithValue(ctx, partitionKey{}, instanceID)
	mount := d.instanceFormsMount(role)
	if mount.Authorize != nil && mount.Authorize(ctx, action) != nil {
		return nil, agencies.ErrInstanceNotFound
	}
	mount.Authorize = nil
	landed := sendsLanded(fm, d.Registry, instanceID)
	recorded := sendsRecorded{FormManager: landed, catalogs: d.Registry, instanceID: instanceID}
	announced := surveysAnnounced{FormManager: recorded, audience: d.Registry, instanceID: instanceID, rules: d.NotifyRules, agency: d.Registry}
	tools, err := formsroutes.BuildGatedTools(announced, mount)
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

func splitFormsInstance(raw json.RawMessage) (string, json.RawMessage, error) {
	args := map[string]json.RawMessage{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &args); err != nil {
			return "", nil, err
		}
	}
	var instanceID string
	if v, ok := args["instance_id"]; ok {
		_ = json.Unmarshal(v, &instanceID)
	}
	if instanceID == "" {
		return "", nil, errFormsInstanceRequired
	}
	delete(args, "instance_id")
	rest, err := json.Marshal(args)
	return instanceID, rest, err
}
