package http

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/aosanya/mwanachama-backend-shared/dispatch"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	mwanachamaassetmanager "wakalaserver/modules/assetmanager"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const (
	changePersonCode   = "member.edit"
	changeLocationCode = "location.edit"
)

var changeToolActions = map[string]string{
	"actor_set_actor_display_name": "actor.actor.set_display_name",
	"actor_set_actor_attributes":   "actor.actor.set_attributes",
	"assetmanager_location_update": "assetmanager.location.update",
}

var changeActionCodes = map[string]string{
	"actor.actor.set_display_name": changePersonCode,
	"actor.actor.set_attributes":   changePersonCode,
	"assetmanager.location.update": changeLocationCode,
}

func init() {
	residentRoleActorActions = append(residentRoleActorActions, "actor.actor.set_display_name", "actor.actor.set_attributes")
}

func (d *Deps) guardChangeTools(server *mcp.Server) {
	server.AddReceivingMiddleware(func(next mcp.MethodHandler) mcp.MethodHandler {
		return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
			call, ok := req.(*mcp.CallToolRequest)
			if !ok || method != "tools/call" || call.Params == nil {
				return next(ctx, method, req)
			}
			action, guarded := changeToolActions[call.Params.Name]
			if guarded {
				if err := d.changeCallAllowed(ctx, call.Params.Arguments, action); err != nil {
					return toolError(err), nil
				}
			}
			return next(ctx, method, req)
		}
	})
}

func (d *Deps) changeCallAllowed(ctx context.Context, raw json.RawMessage, action string) error {
	var args struct {
		InstanceID string `json:"instance_id"`
	}
	if json.Unmarshal(raw, &args) != nil || args.InstanceID == "" || d.Registry == nil {
		return nil
	}
	role, err := d.Registry.RoleOf(ctx, args.InstanceID, accounts.IDFromContext(ctx))
	if err != nil || role == "" || role == agencies.RoleOwner {
		return nil
	}
	if d.callerHoldsAction(withPartitionContext(ctx, args.InstanceID), role, action) {
		return nil
	}
	return changePermissionMissing(action)
}

func (d *Deps) changeNeedsItsCode(role string, authorize dispatch.Authorizer) dispatch.Authorizer {
	if role == agencies.RoleOwner || role == agencies.RoleAgent {
		return authorize
	}
	return func(ctx context.Context, action string) error {
		if _, guarded := changeActionCodes[action]; guarded && !d.callerHoldsAction(ctx, role, action) {
			return dispatch.ErrForbidden
		}
		if authorize == nil {
			return nil
		}
		return authorize(ctx, action)
	}
}

func (d *Deps) assetManagerAdmitting(ctx context.Context, instanceID string) (mwanachamaassetmanager.AssetManager, error) {
	if err := d.admittedHoldingAction(ctx, instanceID, "assetmanager.location.update"); err != nil {
		return nil, err
	}
	return d.Registry.AssetManager(ctx, instanceID)
}

func changePermissionMissing(action string) error {
	code := changeActionCodes[action]
	name := code
	if p, ok := agencymodels.LookupPermission(code); ok {
		name = p.Name
	}
	return fmt.Errorf("you need the permission %q (%s) in this agency to do this; ask its owner to give it to one of your roles", name, code)
}
