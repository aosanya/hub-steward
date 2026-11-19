package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	dispatch "github.com/aosanya/mwanachama-backend-shared/dispatch"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

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
	return d.admittedHolding(ctx, instanceID, permissionRefusal(taskListAction), func(codes []string) bool {
		return slices.Contains(codes, taskReadPermission)
	})
}

func (d *Deps) admittedHoldingAction(ctx context.Context, instanceID, action string) error {
	return d.admittedHolding(ctx, instanceID, permissionRefusal(action), func(codes []string) bool {
		return permissionsAllow(codes, action)
	})
}

func permissionRefusal(action string) error {
	carrier, found := agencymodels.Permission{}, false
	for _, p := range agencymodels.PermissionCatalog() {
		if slices.Contains(p.Actions, action) && (!found || len(p.Actions) < len(carrier.Actions)) {
			carrier, found = p, true
		}
	}
	if !found {
		return fmt.Errorf("%w: you need a permission that allows %s in this agency; ask its owner to give it to one of your roles", dispatch.ErrForbidden, action)
	}
	return fmt.Errorf("%w: you need the permission %q (%s) in this agency to do this; ask its owner to give it to one of your roles", dispatch.ErrForbidden, carrier.Name, carrier.Code)
}

func (d *Deps) admittedHolding(ctx context.Context, instanceID string, refusal error, holds func(codes []string) bool) error {
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
	if cerr != nil || !holds(codes) {
		return refusal
	}
	return opaqueMembershipError(adoptCallerAsActor(ctx, d.Registry, instanceID, caller))
}

func (d *Deps) admittedByRolePermission(ctx context.Context, reg agencies.Registry, instanceID, action string) error {
	err := mustBeMember(ctx, reg, instanceID)
	if err == nil || !errors.Is(err, agencies.ErrInstanceNotFound) {
		return err
	}
	caller := accounts.IDFromContext(ctx)
	role, rerr := reg.RoleOf(ctx, instanceID, caller)
	if caller == "" || rerr != nil || role != agencies.RoleResident {
		return agencies.ErrInstanceNotFound
	}
	if !d.heldRolesAllow(withPartitionContext(ctx, instanceID), reg, action) {
		return permissionRefusal(action)
	}
	return opaqueMembershipError(adoptCallerAsActor(ctx, reg, instanceID, caller))
}

func (d *Deps) heldRolesAllow(ctx context.Context, reg agencies.Registry, action string) bool {
	links, ok := reg.(agencies.AgencyRoleLinks)
	if !ok {
		return false
	}
	roleIDs, err := agentRoleIDs(ctx, reg, links)
	if err != nil || len(roleIDs) == 0 {
		return false
	}
	codes, err := unionPermissions(ctx, d.agencyRolePermissions, roleIDs)
	return err == nil && permissionsAllow(codes, action)
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

func (d *Deps) residentOrRoleHolding(authorize dispatch.Authorizer, actions []string) dispatch.Authorizer {
	return func(ctx context.Context, action string) error {
		if authorize != nil && authorize(ctx, action) == nil {
			return nil
		}
		if !slices.Contains(actions, action) {
			return dispatch.ErrForbidden
		}
		codes, err := d.callerPermissionCodes(ctx, partitionOf(ctx))
		if err != nil || !permissionsAllow(codes, action) {
			return dispatch.ErrForbidden
		}
		return nil
	}
}

func (d *Deps) taskPermissioned(role string, authorize dispatch.Authorizer) dispatch.Authorizer {
	if role == agencies.RoleResident {
		return d.residentPermissioned(authorize)
	}
	return agentPermissioned(role, d.Registry, d.agencyRolePermissions, authorize)
}

var taskMoveActions = map[string]bool{
	"taskmanager.task.place":        true,
	"taskmanager.task.move":         true,
	"taskmanager.task.move_to_step": true,
	"taskmanager.task.claim":        true,
	"taskmanager.task.claim_next":   true,
	"taskmanager.task.heartbeat":    true,
	"taskmanager.task.release":      true,
}

const taskListAction = "taskmanager.task.list"

const roleTooSmallToMove = "your role is too small to move issues"

func (d *Deps) guardTaskToolPermissions(server *mcp.Server, actions map[string]string) {
	server.AddReceivingMiddleware(func(next mcp.MethodHandler) mcp.MethodHandler {
		return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
			call, ok := req.(*mcp.CallToolRequest)
			if !ok || method != "tools/call" || call.Params == nil {
				return next(ctx, method, req)
			}
			action, guarded := actions[call.Params.Name]
			if guarded {
				if refusal := d.taskToolRefusal(ctx, call.Params.Arguments, action); refusal != nil {
					return toolError(refusal), nil
				}
			}
			return next(ctx, method, req)
		}
	})
}

func (d *Deps) taskToolRefusal(ctx context.Context, raw json.RawMessage, action string) error {
	args := map[string]json.RawMessage{}
	if json.Unmarshal(raw, &args) != nil {
		return nil
	}
	var instanceID string
	if json.Unmarshal(args["instance_id"], &instanceID) != nil || instanceID == "" {
		return nil
	}
	role, err := d.Registry.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
	if err != nil {
		return nil
	}
	ctx = withPartitionContext(ctx, instanceID)
	authorize := d.taskPermissioned(role, nil)
	if authorize == nil || authorize(ctx, action) == nil {
		return nil
	}
	if authorize(ctx, taskListAction) != nil {
		return permissionRefusal(taskListAction)
	}
	if taskMoveActions[action] {
		return fmt.Errorf("%w: %s", mwanachamataskmanager.ErrBacklogForbidden, roleTooSmallToMove)
	}
	return fmt.Errorf("%w: your role can look at the backlogs but not change them", mwanachamataskmanager.ErrBacklogForbidden)
}
