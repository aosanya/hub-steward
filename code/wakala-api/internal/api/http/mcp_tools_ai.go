package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	ai "wakalaserver/modules/ai"
	airoutes "wakalaserver/modules/ai/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

func (d *Deps) registerAIMCPTools(server *mcp.Server) {
	if d.AI == nil {
		return
	}
	for _, t := range airoutes.Tools(struct{ ai.Manager }{}) {
		schema := map[string]any{}
		if err := json.Unmarshal(t.InputSchema, &schema); err != nil {
			panic(fmt.Sprintf("ai mcp: %s input schema: %v", t.Name, err))
		}
		props, _ := schema["properties"].(map[string]any)
		if props == nil {
			props = map[string]any{}
		}
		delete(props, "agencyID")
		props["instance_id"] = map[string]any{"type": "string", "description": "The Instance whose AI accounts this call concerns."}
		schema["properties"] = props
		required, _ := schema["required"].([]any)
		kept := []any{"instance_id"}
		for _, r := range required {
			if r != "agencyID" {
				kept = append(kept, r)
			}
		}
		schema["required"] = kept
		name, action := t.Name, t.Action
		server.AddTool(&mcp.Tool{Name: name, Title: t.Title, Description: t.Description, InputSchema: schema}, d.aiToolHandler(name, action))
	}
}

func (d *Deps) aiToolHandler(name, action string) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := map[string]json.RawMessage{}
		if err := json.Unmarshal(req.Params.Arguments, &args); err != nil {
			return toolError(fmt.Errorf("invalid arguments")), nil
		}
		var instanceID string
		if json.Unmarshal(args["instance_id"], &instanceID) != nil || instanceID == "" {
			return toolError(agencies.ErrInstanceNotFound), nil
		}
		delete(args, "instance_id")
		args["agencyID"], _ = json.Marshal(instanceID)
		if err := mustBeMember(ctx, d.Registry, instanceID); err != nil {
			return toolError(agencies.ErrInstanceNotFound), nil
		}
		role, err := d.Registry.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
		if err != nil {
			return toolError(agencies.ErrInstanceNotFound), nil
		}
		pctx := context.WithValue(ctx, partitionKey{}, instanceID)
		if d.aiPermissioned(role, d.Registry, aiAuthorize(role))(pctx, action) != nil {
			if line, ok := aiRefusalLines[action]; ok && role == agencies.RoleAgent {
				return toolError(errors.New(line)), nil
			}
			return toolError(agencies.ErrInstanceNotFound), nil
		}
		m, err := d.AI(ctx, instanceID)
		if err != nil {
			return toolError(agencies.ErrInstanceNotFound), nil
		}
		if action == aiChatAction {
			stampChat(args, accounts.IDFromContext(ctx))
		}
		raw, _ := json.Marshal(args)
		for _, t := range airoutes.ToolsFor(m, airoutes.Mount{Caller: accounts.IDFromContext}) {
			if t.Name != name {
				continue
			}
			out, err := t.Invoke(ctx, raw)
			if err != nil {
				return toolError(err), nil
			}
			structured, text := aiEnvelope(name, out)
			return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: text}}, StructuredContent: structured}, nil
		}
		return toolError(agencies.ErrInstanceNotFound), nil
	}
}

func aiEnvelope(name string, out any) (any, string) {
	b, _ := json.Marshal(out)
	var list []any
	if json.Unmarshal(b, &list) == nil {
		return map[string]any{"items": list}, fmt.Sprintf("Found %d item(s)", len(list))
	}
	return out, name + " completed"
}
