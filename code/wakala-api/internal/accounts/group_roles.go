package accounts

import (
	"context"

	"wakalaserver/internal/agencies"
)

var errGroupRolesUnsupported = agencies.ErrNotAMember

func (r *Router) groupRoles(ctx context.Context) (agencies.GroupRoles, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	roles, ok := reg.(agencies.GroupRoles)
	if !ok {
		return nil, errGroupRolesUnsupported
	}
	return roles, nil
}

func (r *Router) GiveGroupRole(ctx context.Context, instanceID, groupID, agencyRoleID string) error {
	roles, err := r.groupRoles(ctx)
	if err != nil {
		return err
	}
	return roles.GiveGroupRole(ctx, instanceID, groupID, agencyRoleID)
}

func (r *Router) TakeGroupRole(ctx context.Context, instanceID, groupID, agencyRoleID string) error {
	roles, err := r.groupRoles(ctx)
	if err != nil {
		return err
	}
	return roles.TakeGroupRole(ctx, instanceID, groupID, agencyRoleID)
}

func (r *Router) GroupRoleIDs(ctx context.Context, instanceID, groupID string) ([]string, error) {
	roles, err := r.groupRoles(ctx)
	if err != nil {
		return nil, err
	}
	return roles.GroupRoleIDs(ctx, instanceID, groupID)
}

func (r *Router) ListGroupRoles(ctx context.Context, instanceID string) ([]agencies.GroupRole, error) {
	roles, err := r.groupRoles(ctx)
	if err != nil {
		return nil, err
	}
	return roles.ListGroupRoles(ctx, instanceID)
}

func (r *Router) RoleIDsThroughGroups(ctx context.Context, instanceID, userID string) ([]string, error) {
	roles, err := r.groupRoles(ctx)
	if err != nil {
		return nil, err
	}
	return roles.RoleIDsThroughGroups(ctx, instanceID, userID)
}
