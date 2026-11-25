package http

import (
	"context"
	"slices"
	"strings"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type roleWithCodes struct {
	role        agencymodels.Role
	permissions []string
}

func carriesRowAction(permissions []string, record agencymodels.Record, action string) bool {
	code := mwanachamaagency.RecordPermissionCode(record.Code, action)
	if action == agencymodels.RowActionDelete {
		return slices.Contains(permissions, code)
	}
	return slices.ContainsFunc(permissions, func(held string) bool { return strings.HasPrefix(held, code+".") })
}

func (d *Deps) rolesWithCodes(ctx context.Context, instanceID string, roles []agencymodels.Role) []roleWithCodes {
	ctx = withPartitionContext(ctx, instanceID)
	out := make([]roleWithCodes, 0, len(roles))
	for _, role := range roles {
		if role.Deleted {
			continue
		}
		permissions, err := d.agencyRolePermissions(ctx, role.ID)
		if err != nil {
			continue
		}
		out = append(out, roleWithCodes{role: role, permissions: permissions})
	}
	return out
}

func (d *Deps) callerRolesWithCodes(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager) []roleWithCodes {
	held, err := heldAgencyRoles(ctx, d.Registry, instanceID, m)
	if err != nil {
		return nil
	}
	return d.rolesWithCodes(ctx, instanceID, held.Roles)
}

func (d *Deps) rowRoleOf(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, draftID string, record agencymodels.Record, action string) (string, error) {
	var candidates []roleWithCodes
	if callerIsPlatformOwner(ctx, d.Registry, instanceID) {
		roles, err := m.ListRoles(ctx, draftID, mwanachamaagency.RoleFilter{})
		if err != nil {
			return "", err
		}
		candidates = d.rolesWithCodes(ctx, instanceID, roles)
	} else {
		candidates = d.callerRolesWithCodes(ctx, instanceID, m)
	}
	for _, candidate := range candidates {
		if carriesRowAction(candidate.permissions, record, action) {
			return candidate.role.ID, nil
		}
	}
	return "", errRowForbidden
}

func (d *Deps) rowRoleOfWrite(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, draftID string, record agencymodels.Record, replaces string) (string, error) {
	if replaces == "" {
		return d.rowRoleOf(ctx, instanceID, m, draftID, record, agencymodels.RowActionAdd)
	}
	replaced, found, err := designerRowOf(ctx, m, designerRowCall{DraftID: draftID, RowID: replaces})
	if err != nil {
		return "", err
	}
	if !found {
		return "", errRowForbidden
	}
	return replaced.RoleID, nil
}
