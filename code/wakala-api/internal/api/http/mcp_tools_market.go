package http

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	market "wakalaserver/modules/market"
	marketroutes "wakalaserver/modules/market/routes"
	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
)

type marketToolShape struct{ market.MarketManager }

func marketShapeTools() []marketroutes.Tool {
	tools, err := marketroutes.BuildTools(marketToolShape{}, marketroutes.Mount{})
	if err != nil {
		panic(fmt.Sprintf("market mcp: %v", err))
	}
	return tools
}

func marketToolActions() map[string]string {
	out := map[string]string{}
	for _, t := range marketShapeTools() {
		out[t.Name] = t.Action
	}
	for name, action := range mountToolActions() {
		out[name] = action
	}
	return out
}

func (d *Deps) registerMarketMCPTools(server *mcp.Server) {
	if d.Registry == nil {
		return
	}
	d.registerModuleMountTool(server)
	d.registerModuleToolsTool(server)
	for _, t := range marketShapeTools() {
		server.AddTool(&mcp.Tool{
			Name:        t.Name,
			Title:       t.Title,
			Description: t.Description,
			InputSchema: withMarketName(withAgencyInstance(t.Name, t.InputSchema, "The agency whose market this call reads or writes.")),
		}, d.marketToolHandler(t.Name, t.Action))
	}
}

func (d *Deps) marketToolHandler(name, action string) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		out, err := d.invokeMarketTool(ctx, name, action, req.Params.Arguments)
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

func (d *Deps) invokeMarketTool(ctx context.Context, name, action string, raw []byte) (any, error) {
	instanceID, rest, err := splitFormsInstance(raw)
	if err != nil {
		return nil, err
	}
	marketName, rest, err := splitMarketName(rest)
	if err != nil {
		return nil, err
	}
	mm, err := marketManagerNamed(ctx, d.Registry, instanceID, marketName)
	if err != nil {
		return nil, err
	}
	mm = d.marketAnnounced(mm, instanceID)
	role, err := d.Registry.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
	if err != nil {
		return nil, err
	}
	ctx = context.WithValue(ctx, partitionKey{}, instanceID)
	mount := d.instanceMarketMount(role)
	if mount.Authorize != nil && mount.Authorize(ctx, action) != nil {
		return nil, dispatch.ErrForbidden
	}
	mount.Authorize = nil
	tools, err := marketroutes.BuildTools(mm, mount)
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

func withMarketName(schema map[string]any) map[string]any {
	props, _ := schema["properties"].(map[string]any)
	props["market"] = map[string]any{"type": "string", "description": "The name of the market this call is for. Leave it out while the agency runs one market; name it when the agency runs more."}
	return schema
}

func splitMarketName(raw json.RawMessage) (string, json.RawMessage, error) {
	args := map[string]json.RawMessage{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &args); err != nil {
			return "", nil, err
		}
	}
	var name string
	if v, ok := args["market"]; ok {
		_ = json.Unmarshal(v, &name)
	}
	delete(args, "market")
	rest, err := json.Marshal(args)
	return name, rest, err
}
