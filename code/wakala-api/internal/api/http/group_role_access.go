package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	dispatch "github.com/aosanya/mwanachama-backend-shared/dispatch"
	mwanachamataskmanager "github.com/aosanya/mwanachama-backend-taskmanager"

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
		return slices.Contains(codes, taskReadPermission) || d.assumedGroupHoldsBacklogAccess(ctx, instanceID)
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

func (d *Deps) heldRolesAllow(ctx context.Context, reg agencies.Registry, action string) bool {
	roleIDs, err := callerRoleIDs(ctx, reg, partitionOf(ctx))
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
	byRole := d.taskPermissionedByRole(role, authorize)
	if role != agencies.RoleResident && role != agencies.RoleAgent {
		return byRole
	}
	return func(ctx context.Context, action string) error {
		refusal := byRole(ctx, action)
		if refusal == nil || !backlogAccessActions[action] || !d.assumedGroupHoldsBacklogAccess(ctx, partitionOf(ctx)) {
			return refusal
		}
		if authorize == nil {
			return nil
		}
		return authorize(ctx, action)
	}
}

func (d *Deps) taskPermissionedByRole(role string, authorize dispatch.Authorizer) dispatch.Authorizer {
	if role == agencies.RoleResident {
		return d.residentPermissioned(authorize)
	}
	return agentPermissioned(role, d.Registry, d.agencyRolePermissions, authorize)
}

func (d *Deps) assumedGroupHoldsBacklogAccess(ctx context.Context, instanceID string) bool {
	holds, err := agencies.AssumedGroupHoldsBacklogAccess(ctx, d.Registry, instanceID, accounts.IDFromContext(ctx))
	return err == nil && holds
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

var backlogReadActions = []string{
	"taskmanager.backlog.list",
	"taskmanager.backlog_access.list",
	"taskmanager.backlog.rules_count",
	"taskmanager.task.list",
	"taskmanager.task.read",
	"taskmanager.task.read_by_name",
	"taskmanager.task.find",
	"taskmanager.task.pending",
	"taskmanager.task.board_snapshot",
	"taskmanager.task.changes_since",
	"taskmanager.task.next_ready",
	"taskmanager.task.next_ready_batch",
	"taskmanager.task.stuck",
	"taskmanager.task.timed_out",
	"taskmanager.task.list_overdue",
	"taskmanager.task.brief",
	"taskmanager.task.dependencies",
	"taskmanager.task.report",
	"taskmanager.task.note_list",
	"taskmanager.task.reference_list",
	"taskmanager.task.list_assignments",
	"taskmanager.task.todo.pending",
	"taskmanager.task_todo.list_for_issue",
	"taskmanager.task_todo.ready",
	"taskmanager.task_todo.ready_board",
	"taskmanager.task_todo.count_for_issues",
	"taskmanager.task_state.list",
	"taskmanager.deliverable.list",
	"taskmanager.acceptance_criteria.list",
	"taskmanager.task.caps_read",
	"taskmanager.task.file_overlaps",
	"taskmanager.task.lint",
	"taskmanager.relationship.traverse",
}

var backlogWriteActions = []string{
	"taskmanager.task.create",
	"taskmanager.task.update",
	"taskmanager.task.patch",
	"taskmanager.task.place",
	"taskmanager.task.move",
	"taskmanager.task.move_to_step",
	"taskmanager.task.delete",
	"taskmanager.task.claim",
	"taskmanager.task.claim_next",
	"taskmanager.task.heartbeat",
	"taskmanager.task.release",
	"taskmanager.task.assign",
	"taskmanager.task.assign_holder",
	"taskmanager.task.unassign",
	"taskmanager.task.unblock",
	"taskmanager.task.unblock_dependents",
	"taskmanager.task.batch",
	"taskmanager.task.add_todos",
	"taskmanager.task.note_add",
	"taskmanager.task.create_with_todos",
	"taskmanager.task.create_in_project",
	"taskmanager.task.caps_set",
	"taskmanager.task.caps_clear",
	"taskmanager.project.add_task",
	"taskmanager.project.remove_task",
	"taskmanager.relationship.create",
	"taskmanager.relationship.delete",
	"taskmanager.sourced_task.open",
	"taskmanager.task_todo.update",
	"taskmanager.task_todo.finish",
	"taskmanager.task_todo.set_status",
	"taskmanager.task_todo.reorder",
	"taskmanager.backlog.rename",
	"taskmanager.backlog.archive",
	"taskmanager.backlog.unarchive",
	"taskmanager.backlog.delete",
	"taskmanager.backlog.manage",
	"taskmanager.backlog.rules_set",
	"taskmanager.backlog_step.add",
	"taskmanager.backlog_step.rename",
	"taskmanager.backlog_step.reorder",
	"taskmanager.backlog_step.remove",
	"taskmanager.backlog_step.wip_limit",
	"taskmanager.backlog_access.give",
	"taskmanager.backlog_access.take",
}

var backlogAccessActions = actionSet(backlogReadActions, backlogWriteActions)

func actionSet(lists ...[]string) map[string]bool {
	set := map[string]bool{}
	for _, list := range lists {
		for _, action := range list {
			set[action] = true
		}
	}
	return set
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
