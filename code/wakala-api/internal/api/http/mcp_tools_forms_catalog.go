package http

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	catalogroutes "wakalaserver/modules/catalog/routes"

	"wakalaserver/internal/agencies"
)

const formsCatalogToolPrefix = "forms_catalog_"

func formsCatalogToolName(name string) string {
	return formsCatalogToolPrefix + strings.TrimPrefix(name, catalogToolPrefix)
}

func (d *Deps) registerFormsCatalogMCPTools(server *mcp.Server) {
	if d.Registry == nil {
		return
	}
	for _, t := range catalogroutes.ToolsFor(formsCatalogShape{}, formsCatalogRouteMount) {
		server.AddTool(&mcp.Tool{
			Name:        formsCatalogToolName(t.Name),
			Title:       t.Title,
			Description: t.Description,
			InputSchema: withAgencyInstance(t.Name, t.InputSchema, "The agency whose forms catalog this call reads or writes."),
		}, d.formsCatalogToolHandler(t.Name))
	}
}

func (d *Deps) formsCatalogToolHandler(name string) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		out, err := d.invokeFormsCatalogTool(ctx, name, req.Params.Arguments)
		if err != nil {
			return toolError(err), nil
		}
		return toolText(rendering(out), false), nil
	}
}

func (d *Deps) invokeFormsCatalogTool(ctx context.Context, name string, raw json.RawMessage) (any, error) {
	instanceID, rest, err := splitFormsInstance(raw)
	if err != nil {
		return nil, err
	}
	cm, err := formsCatalogForAction(ctx, d.Registry, instanceID, formsCatalogToolAction(name), subjectIDOf(rest), scopeIDOf(rest))
	if err != nil {
		return nil, err
	}
	if d.linkedAgentRefused(ctx, instanceID, formsCatalogToolAction(name)) {
		return nil, agencies.ErrInstanceNotFound
	}
	for _, t := range catalogroutes.ToolsFor(cm, formsCatalogRouteMount) {
		if t.Name == name {
			return t.Invoke(ctx, rest)
		}
	}
	return nil, fmt.Errorf("unknown tool %s", formsCatalogToolName(name))
}

func formsCatalogToolAction(name string) string {
	for _, t := range catalogroutes.ToolsFor(formsCatalogShape{}, formsCatalogRouteMount) {
		if t.Name == name {
			return t.Action
		}
	}
	return ""
}

func scopeIDOf(raw json.RawMessage) string {
	var args struct {
		ScopeID string `json:"scope_id"`
	}
	if len(raw) == 0 || json.Unmarshal(raw, &args) != nil {
		return ""
	}
	return args.ScopeID
}

func subjectIDOf(raw json.RawMessage) string {
	var args struct {
		SubjectID string `json:"subject_id"`
	}
	if len(raw) == 0 || json.Unmarshal(raw, &args) != nil {
		return ""
	}
	return args.SubjectID
}
