package http

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamagit "wakalaserver/modules/git"
	gitroutes "wakalaserver/modules/git/routes"
	"wakalaserver/modules/shared/dispatch"
)

const formsGitToolPrefix = "forms_git_"

func formsGitToolName(name string) string {
	return formsGitToolPrefix + strings.TrimPrefix(name, "git_")
}

func formsGitTools(gm mwanachamagit.GitManager) ([]dispatch.Tool, error) {
	s, err := gitroutes.Table.Spec()
	if err != nil {
		return nil, err
	}
	return dispatch.Tools(s, dispatch.Deps{
		Manager: gm, Errors: gitroutes.Sentinels, Authorize: formsGitRouteMount.Authorize, Caller: formsGitRouteMount.Caller,
	})
}

func (d *Deps) registerFormsGitMCPTools(server *mcp.Server) {
	if d.Registry == nil {
		return
	}
	tools, err := formsGitTools(formsGitShape{})
	if err != nil {
		panic(fmt.Sprintf("forms git mcp: %v", err))
	}
	for _, t := range tools {
		server.AddTool(&mcp.Tool{
			Name:        formsGitToolName(t.Name),
			Title:       t.Title,
			Description: t.Description,
			InputSchema: withAgencyInstance(t.Name, t.InputSchema, "The agency whose forms git repository this call reads or writes."),
		}, d.formsGitToolHandler(t.Name))
	}
}

func (d *Deps) formsGitToolHandler(name string) mcp.ToolHandler {
	return func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		out, err := d.invokeFormsGitTool(ctx, name, req.Params.Arguments)
		if err != nil {
			return toolError(err), nil
		}
		return toolText(rendering(out), false), nil
	}
}

func (d *Deps) invokeFormsGitTool(ctx context.Context, name string, raw json.RawMessage) (any, error) {
	instanceID, rest, err := splitFormsInstance(raw)
	if err != nil {
		return nil, err
	}
	gm, err := formsGitFor(ctx, d.Registry, instanceID)
	if err != nil {
		return nil, err
	}
	tools, err := formsGitTools(gm)
	if err != nil {
		return nil, err
	}
	for _, t := range tools {
		if t.Name == name {
			return t.Invoke(ctx, rest)
		}
	}
	return nil, fmt.Errorf("unknown tool %s", formsGitToolName(name))
}
