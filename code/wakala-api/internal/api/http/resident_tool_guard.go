package http

import (
	"context"
	"encoding/json"
	"errors"
	"slices"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type residentClearedKey struct{}

func (d *Deps) guardResidentToolPermissions(server *mcp.Server, actions map[string]string) {
	server.AddReceivingMiddleware(func(next mcp.MethodHandler) mcp.MethodHandler {
		return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
			call, ok := req.(*mcp.CallToolRequest)
			if !ok || method != "tools/call" || call.Params == nil {
				return next(ctx, method, req)
			}
			action, guarded := actions[call.Params.Name]
			if !guarded {
				return next(ctx, method, req)
			}
			cleared, refusal := d.residentToolClearance(ctx, call.Params.Arguments, action)
			if refusal != nil {
				return toolError(refusal), nil
			}
			return next(cleared, method, req)
		}
	})
}

func (d *Deps) residentToolClearance(ctx context.Context, raw json.RawMessage, action string) (context.Context, error) {
	args := map[string]json.RawMessage{}
	if json.Unmarshal(raw, &args) != nil {
		return ctx, nil
	}
	var instanceID string
	if json.Unmarshal(args["instance_id"], &instanceID) != nil || instanceID == "" {
		return ctx, nil
	}
	role, err := d.Registry.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
	if err != nil || role != agencies.RoleResident {
		return ctx, nil
	}
	if !slices.Contains(residentMayActions, action) && d.residentPermissioned(nil)(withPartitionContext(ctx, instanceID), action) != nil {
		return ctx, permissionRefusal(action)
	}
	return context.WithValue(ctx, residentClearedKey{}, instanceID), nil
}

func (d *Deps) memberOrClearedResident(ctx context.Context, instanceID string) error {
	err := mustBeMember(ctx, d.Registry, instanceID)
	if err == nil || !errors.Is(err, agencies.ErrInstanceNotFound) {
		return err
	}
	if cleared, _ := ctx.Value(residentClearedKey{}).(string); cleared != instanceID {
		return err
	}
	caller := accounts.IDFromContext(ctx)
	role, rerr := d.Registry.RoleOf(ctx, instanceID, caller)
	if rerr != nil || role != agencies.RoleResident {
		return agencies.ErrInstanceNotFound
	}
	return opaqueMembershipError(adoptCallerAsActor(ctx, d.Registry, instanceID, caller))
}
