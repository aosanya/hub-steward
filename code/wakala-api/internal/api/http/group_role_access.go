package http

import (
	"context"
	"encoding/json"
	"errors"
	"slices"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	dispatch "wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const taskReadPermission = "task.read"

func (d *Deps) callerPermissionCodes(ctx context.Context, instanceID string) ([]string, error) {
	m, err := d.Registry.AgencyManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	held, err := heldAgencyRoles(ctx, d.Registry, instanceID, m)
	if err != nil {
		if errors.Is(err, errNoLiveVersion) {
			return []string{}, nil
		}
		return nil, err
	}
	roles := make([]heldAgencyRole, 0, len(held.Roles))
	for _, role := range held.Roles {
		if !role.Deleted {
			roles = append(roles, heldAgencyRole{ID: role.ID, Code: role.Code, Name: role.Name})
		}
	}
	return d.heldPermissionCodes(ctx, roles)
}

func (d *Deps) taskManagerAdmitted(ctx context.Context, instanceID string) error {
	err := mustBeMember(ctx, d.Registry, instanceID)
	if err == nil || !errors.Is(err, agencies.ErrInstanceNotFound) {
		return err
	}
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return err
	}
	role, rerr := d.Registry.RoleOf(ctx, instanceID, caller)
	if rerr != nil || role != agencies.RoleResident {
		return agencies.ErrInstanceNotFound
	}
	codes, cerr := d.callerPermissionCodes(withPartitionContext(ctx, instanceID), instanceID)
	if cerr != nil || !slices.Contains(codes, taskReadPermission) {
		return agencies.ErrInstanceNotFound
	}
	return opaqueMembershipError(adoptCallerAsActor(ctx, d.Registry, instanceID, caller))
}

func withPartitionContext(ctx context.Context, instanceID string) context.Context {
	return context.WithValue(ctx, partitionKey{}, instanceID)
}

func (d *Deps) residentPermissioned(authorize dispatch.Authorizer) dispatch.Authorizer {
	return func(ctx context.Context, action string) error {
		instanceID := partitionOf(ctx)
		codes, err := d.callerPermissionCodes(ctx, instanceID)
		if err != nil || !permissionsAllow(codes, action) {
			return dispatch.ErrForbidden
		}
		if authorize == nil {
			return nil
		}
		return authorize(ctx, action)
	}
}

func (d *Deps) taskPermissioned(role string, authorize dispatch.Authorizer) dispatch.Authorizer {
	if role == agencies.RoleResident {
		return d.residentPermissioned(authorize)
	}
	return agentPermissioned(role, d.Registry, d.agencyRolePermissions, authorize)
}

func (d *Deps) guardTaskToolPermissions(server *mcp.Server, actions map[string]string) {
	server.AddReceivingMiddleware(func(next mcp.MethodHandler) mcp.MethodHandler {
		return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
			call, ok := req.(*mcp.CallToolRequest)
			if !ok || method != "tools/call" || call.Params == nil {
				return next(ctx, method, req)
			}
			action, guarded := actions[call.Params.Name]
			if guarded && d.taskToolRefused(ctx, call.Params.Arguments, action) {
				return toolError(agencies.ErrInstanceNotFound), nil
			}
			return next(ctx, method, req)
		}
	})
}

func (d *Deps) taskToolRefused(ctx context.Context, raw json.RawMessage, action string) bool {
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
	ctx = withPartitionContext(ctx, instanceID)
	authorize := d.taskPermissioned(role, nil)
	return authorize != nil && authorize(ctx, action) != nil
}
