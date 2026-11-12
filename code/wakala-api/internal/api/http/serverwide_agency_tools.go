package http

import (
	"context"
	"encoding/json"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	catalogroutes "wakalaserver/modules/catalog/routes"
	"wakalaserver/modules/shared/dispatch"
)

func (d *Deps) registerAgencyCatalogMCPTools(server *mcp.Server, mountName string, m catalogroutes.Mount, toolName func(string) string) {
	for _, tool := range catalogroutes.ToolsFor(formsCatalogShape{}, m) {
		server.AddTool(&mcp.Tool{
			Name:        toolName(tool.Name),
			Title:       tool.Title,
			Description: tool.Description,
			InputSchema: withOptionalAgencyInstance(tool.Name, tool.InputSchema),
		}, d.agencyCatalogToolHandler(mountName, m, tool.Name))
	}
}

func (d *Deps) agencyCatalogToolHandler(mountName string, m catalogroutes.Mount, name string) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		named, rest, err := splitOptionalInstance(req.Params.Arguments)
		if err != nil {
			return toolText(err.Error(), true), nil
		}
		instanceID, err := d.agencyOfCaller(ctx, named, false)
		if err != nil {
			return toolText(err.Error(), true), nil
		}
		cm, err := d.Registry.CatalogManager(ctx, instanceID, mountName)
		if err != nil {
			return toolText(err.Error(), true), nil
		}
		for _, tool := range catalogroutes.ToolsFor(cm, m) {
			if tool.Name != name {
				continue
			}
			out, err := tool.Handle(withPartitionContext(ctx, instanceID), dispatch.Request{Arguments: rest, Meta: req.Params.Meta})
			if err != nil {
				return toolText(err.Error(), true), nil
			}
			return toolText(rendering(out), false), nil
		}
		return toolText("unknown tool "+name, true), nil
	}
}

func withOptionalAgencyInstance(name string, raw json.RawMessage) map[string]any {
	schema := withAgencyInstance(name, raw, "The agency this call reads or writes; left out, the agency the caller belongs to.")
	required, _ := schema["required"].([]any)
	schema["required"] = required[:len(required)-1]
	return schema
}

func splitOptionalInstance(raw json.RawMessage) (string, json.RawMessage, error) {
	args := map[string]json.RawMessage{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &args); err != nil {
			return "", nil, err
		}
	}
	var instanceID string
	if v, ok := args[agencyQuery]; ok {
		_ = json.Unmarshal(v, &instanceID)
	}
	delete(args, agencyQuery)
	rest, err := json.Marshal(args)
	return instanceID, rest, err
}
