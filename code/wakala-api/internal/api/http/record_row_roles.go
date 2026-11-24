package http

import (
	"context"
	"slices"
	"strings"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
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

func (d *Deps) callerMayDoRowAction(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record, action string) bool {
	return d.callerMayRowAnyOf(ctx, instanceID, m, record, action)
}

func (d *Deps) callerMayAddRows(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record) bool {
	return d.callerMayDoRowAction(ctx, instanceID, m, record, agencymodels.RowActionAdd)
}

func (d *Deps) callerMaySeeEveryRow(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record) bool {
	return d.callerMayRowAnyOf(ctx, instanceID, m, record, agencymodels.RowActionAdd, mwanachamaagency.RecordViewAction)
}

func (d *Deps) callerMayRowAnyOf(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record, actions ...string) bool {
	if callerIsPlatformOwner(ctx, d.Registry, instanceID) {
		return true
	}
	role, err := d.Registry.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
	if err != nil || (role != agencies.RoleAgent && role != agencies.RoleResident) {
		return false
	}
	for _, held := range d.callerRolesWithCodes(ctx, instanceID, m) {
		for _, action := range actions {
			if carriesRowAction(held.permissions, record, action) {
				return true
			}
		}
	}
	return false
}

func (d *Deps) rowRoleOf(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, draftID string, record agencymodels.Record) (string, error) {
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
		if carriesRowAction(candidate.permissions, record, agencymodels.RowActionAdd) {
			return candidate.role.ID, nil
		}
	}
	return "", errRowForbidden
}

func (d *Deps) rowStepsOpenToCaller(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, held heldRoles) ([]agencymodels.WorkItem, map[string]agencymodels.Role, error) {
	steps, err := m.ListWorkItems(ctx, held.DraftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		return nil, nil, err
	}
	records, err := m.ListRecords(ctx, held.DraftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		return nil, nil, err
	}
	holders := d.rolesWithCodes(ctx, instanceID, held.Roles)
	var open []agencymodels.WorkItem
	roleOf := map[string]agencymodels.Role{}
	for _, step := range steps {
		if step.Deleted || step.RowRecord == "" || step.RoleID != "" {
			continue
		}
		at := slices.IndexFunc(records, func(r agencymodels.Record) bool { return !r.Deleted && r.Identity() == step.RowRecord })
		if at < 0 {
			continue
		}
		for _, holder := range holders {
			if carriesRowAction(holder.permissions, records[at], step.RowAction) {
				open = append(open, step)
				roleOf[step.ID] = holder.role
				break
			}
		}
	}
	return open, roleOf, nil
}
