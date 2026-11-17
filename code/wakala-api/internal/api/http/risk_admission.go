package http

import (
	"context"
	"encoding/json"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamariskmanager "wakalaserver/modules/riskmanager"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const riskListAction = "riskmanager.risk.list"

func (d *Deps) riskManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamariskmanager.RiskManager, error) {
	if err := mustBeMounted(ctx, reg, instanceID, riskModule); err != nil {
		return nil, err
	}
	if err := d.admittedHoldingAction(ctx, instanceID, riskListAction); err != nil {
		return nil, err
	}
	return reg.RiskManager(ctx, instanceID)
}

func (d *Deps) guardRiskResidentTools(server *mcp.Server, actions map[string]string) {
	server.AddReceivingMiddleware(func(next mcp.MethodHandler) mcp.MethodHandler {
		return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
			call, ok := req.(*mcp.CallToolRequest)
			if !ok || method != "tools/call" || call.Params == nil {
				return next(ctx, method, req)
			}
			action, guarded := actions[call.Params.Name]
			if guarded && d.residentRiskToolRefused(ctx, call.Params.Arguments, action) {
				return toolError(permissionRefusal(action)), nil
			}
			return next(ctx, method, req)
		}
	})
}

func (d *Deps) residentRiskToolRefused(ctx context.Context, raw json.RawMessage, action string) bool {
	args := map[string]json.RawMessage{}
	if json.Unmarshal(raw, &args) != nil {
		return false
	}
	var instanceID string
	if json.Unmarshal(args["instance_id"], &instanceID) != nil || instanceID == "" {
		return false
	}
	role, err := d.Registry.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
	if err != nil || role != agencies.RoleResident {
		return false
	}
	return d.residentPermissioned(nil)(withPartitionContext(ctx, instanceID), action) != nil
}
