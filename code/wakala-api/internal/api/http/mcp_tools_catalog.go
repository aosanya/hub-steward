package http

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	catalogroutes "wakalaserver/modules/catalog/routes"
	"wakalaserver/modules/shared/dispatch"
)

func (d *Deps) registerCatalogMCPTools(server *mcp.Server) {
	if d.Catalog == nil {
		return
	}
	for _, tool := range catalogroutes.ToolsFor(d.Catalog, d.catalogMount()) {
		server.AddTool(&mcp.Tool{
			Name:        tool.Name,
			Title:       tool.Title,
			Description: tool.Description,
			InputSchema: tool.InputSchema,
		}, catalogToolHandler(tool))
	}
}

func (d *Deps) registerReportsMCPTools(server *mcp.Server) {
	if d.Reports == nil {
		return
	}
	for _, tool := range catalogroutes.ToolsFor(d.Reports, d.reportsMount()) {
		server.AddTool(&mcp.Tool{
			Name:        reportsToolName(tool.Name),
			Title:       tool.Title,
			Description: tool.Description,
			InputSchema: tool.InputSchema,
		}, catalogToolHandler(tool))
	}
}

func reportsToolName(name string) string {
	return reportsToolPrefix + strings.TrimPrefix(name, catalogToolPrefix)
}

const (
	catalogToolPrefix = "catalog_"
	reportsToolPrefix = "reports_"
)

func catalogToolHandler(tool catalogroutes.Tool) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		out, err := tool.Handle(ctx, dispatch.Request{Arguments: req.Params.Arguments, Meta: req.Params.Meta})
		if err != nil {
			return toolText(err.Error(), true), nil
		}
		return toolText(rendering(out), false), nil
	}
}

func rendering(out any) string {
	if out == nil {
		return "done"
	}
	encoded, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return "done"
	}
	return string(encoded)
}

func toolText(text string, failed bool) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		IsError: failed,
		Content: []mcp.Content{&mcp.TextContent{Text: text}},
	}
}
