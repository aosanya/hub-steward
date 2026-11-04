package http

import (
	"context"
	"encoding/json"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/modules/shared/dispatch"
	mwanachamasources "wakalaserver/modules/sources"
	sourcesmcp "wakalaserver/modules/sources/mcp"
	sourcesroutes "wakalaserver/modules/sources/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type sourceResolver = sourcesmcp.ManagerResolver

func (d *Deps) registerSourcesMCPTools(server *mcp.Server, resolve sourceResolver) {
	sourcesmcp.RegisterResolvedTools(server, resolve, sourcesMount())
	actions := map[string]string{}
	for _, t := range sourcesroutes.Tools(struct {
		mwanachamasources.SourceManager
	}{}, sourcesroutes.Mount{}) {
		actions[t.Name] = t.Action
	}
	d.guardToolPermissions(server, actions)
}

func (d *Deps) guardToolPermissions(server *mcp.Server, actions map[string]string) {
	server.AddReceivingMiddleware(func(next mcp.MethodHandler) mcp.MethodHandler {
		return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
			call, ok := req.(*mcp.CallToolRequest)
			if !ok || method != "tools/call" || call.Params == nil {
				return next(ctx, method, req)
			}
			action, guarded := actions[call.Params.Name]
			if guarded && d.sourcesToolRefused(ctx, call.Params.Arguments, action) {
				return toolError(agencies.ErrInstanceNotFound), nil
			}
			return next(ctx, method, req)
		}
	})
}

func (d *Deps) sourcesToolRefused(ctx context.Context, raw json.RawMessage, action string) bool {
	args := map[string]json.RawMessage{}
	if json.Unmarshal(raw, &args) != nil {
		return false
	}
	var instanceID string
	if json.Unmarshal(args["instance_id"], &instanceID) != nil || instanceID == "" {
		return false
	}
	role, err := d.Registry.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
	if err != nil {
		return false
	}
	ctx = context.WithValue(ctx, partitionKey{}, instanceID)
	authorize := agentPermissioned(role, d.Registry, d.agencyRolePermissions, dispatch.Authorizer(nil))
	return authorize != nil && authorize(ctx, action) != nil
}
