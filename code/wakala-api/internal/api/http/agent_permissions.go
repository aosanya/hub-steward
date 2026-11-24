package http

import (
	"context"
	"errors"
	"net/http"
	"slices"

	"github.com/aosanya/mwanachama-backend-shared/dispatch"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type rolePermissions func(ctx context.Context, roleID string) ([]string, error)

func allowedActions(permissionCodes []string) map[string]bool {
	out := map[string]bool{}
	for _, code := range permissionCodes {
		p, ok := agencymodels.LookupPermission(code)
		if !ok {
			continue
		}
		for _, a := range p.Actions {
			out[a] = true
		}
	}
	return out
}

var permissionsAllow = func(permissionCodes []string, action string) bool {
	return allowedActions(permissionCodes)[action]
}

func agentPermissioned(role string, reg agencies.Registry, permissions rolePermissions, authorize dispatch.Authorizer, seatedMay ...string) dispatch.Authorizer {
	if role != agencies.RoleAgent {
		return authorize
	}
	return func(ctx context.Context, action string) error {
		roleIDs, err := callerRoleIDs(ctx, reg, partitionOf(ctx))
		if err != nil || len(roleIDs) == 0 {
			return dispatch.ErrForbidden
		}
		if !slices.Contains(seatedMay, action) && !everySeatedAgentMay(action) {
			codes, err := unionPermissions(ctx, permissions, roleIDs)
			if err != nil || !permissionsAllow(codes, action) {
				return dispatch.ErrForbidden
			}
		}
		if authorize == nil {
			return nil
		}
		return authorize(ctx, action)
	}
}

func callerRoleIDs(ctx context.Context, reg agencies.Registry, instanceID string) ([]string, error) {
	keys, err := callerRoleKeys(ctx, reg, instanceID)
	if err != nil || len(keys) == 0 {
		return []string{}, err
	}
	m, err := reg.AgencyManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	held, err := rolesMatching(ctx, m, keys)
	if err != nil && !errors.Is(err, errNoLiveVersion) {
		return nil, err
	}
	ids := []string{}
	for _, role := range held.Roles {
		if !role.Deleted {
			ids = append(ids, role.ID)
			delete(keys, role.ID)
			delete(keys, role.Code)
		}
	}
	for key := range keys {
		ids = append(ids, key)
	}
	slices.Sort(ids)
	return ids, nil
}

func (d *Deps) callerRolePermissionCodes(ctx context.Context, instanceID string) ([]string, error) {
	ctx = withPartitionContext(ctx, instanceID)
	roleIDs, err := callerRoleIDs(ctx, d.Registry, instanceID)
	if err != nil || len(roleIDs) == 0 {
		return []string{}, err
	}
	return unionPermissions(ctx, d.agencyRolePermissions, roleIDs)
}

func unionPermissions(ctx context.Context, permissions rolePermissions, roleIDs []string) ([]string, error) {
	codes := []string{}
	for _, id := range roleIDs {
		granted, err := permissions(ctx, id)
		if err != nil {
			return nil, err
		}
		codes = append(codes, granted...)
	}
	return codes, nil
}

func (d *Deps) requireAgentMay(ctx context.Context, instanceID, action string) error {
	if d.linkedAgentRefused(ctx, instanceID, action) {
		return dispatch.ErrForbidden
	}
	return nil
}

func (d *Deps) callerRole(r *http.Request, instanceID string) string {
	role, err := d.Registry.RoleOf(r.Context(), instanceID, accounts.IDFromContext(r.Context()))
	if err != nil {
		return ""
	}
	return role
}

func (d *Deps) agencyRolePermissions(ctx context.Context, roleID string) ([]string, error) {
	if d.rolePermissionsOverride != nil {
		return d.rolePermissionsOverride(ctx, roleID)
	}
	return d.cachedRolePermissions(ctx, roleID)
}

const joinRequestDecideAction = "actor.join_request.approve"

func (d *Deps) agentMayDecideJoinRequests(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		r = withPartition(r, instanceID)
		role := d.callerRole(r, instanceID)
		if role == agencies.RoleAgent {
			gate := agentPermissioned(role, d.Registry, d.agencyRolePermissions, nil)
			if gate(r.Context(), joinRequestDecideAction) != nil {
				writeErr(w, http.StatusForbidden, "forbidden")
				return
			}
		}
		if role == agencies.RoleResident && d.residentHolds(r.Context(), instanceID, joinRequestDecideAction) {
			r = r.WithContext(context.WithValue(r.Context(), joinDecisionPermitted{}, true))
		}
		next(w, r)
	}
}

type joinDecisionPermitted struct{}

func mustBeMemberOrPermitted(ctx context.Context, reg agencies.Registry, instanceID string) error {
	if permitted, _ := ctx.Value(joinDecisionPermitted{}).(bool); permitted {
		return nil
	}
	return mustBeMember(ctx, reg, instanceID)
}

func (d *Deps) residentHolds(ctx context.Context, instanceID, action string) bool {
	role, err := d.Registry.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
	if err != nil || role != agencies.RoleResident {
		return false
	}
	codes, err := d.callerPermissionCodes(withPartitionContext(ctx, instanceID), instanceID)
	return err == nil && permissionsAllow(codes, action)
}
