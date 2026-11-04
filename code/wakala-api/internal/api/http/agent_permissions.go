package http

import (
	"context"
	"net/http"
	"slices"

	"wakalaserver/modules/shared/dispatch"

	agencymodels "wakalaserver/modules/agency/models"

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
	links, ok := reg.(agencies.AgencyRoleLinks)
	if !ok {
		return authorize
	}
	return func(ctx context.Context, action string) error {
		roleID, err := links.AgencyRoleOf(ctx, partitionOf(ctx), accounts.IDFromContext(ctx))
		if err != nil {
			return dispatch.ErrForbidden
		}
		if roleID == "" {
			return dispatch.ErrForbidden
		}
		if !slices.Contains(seatedMay, action) && !everySeatedAgentMay(action) {
			codes, err := permissions(ctx, roleID)
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
		next(w, r)
	}
}
