package http

import (
	"context"
	"slices"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func letRoleDo(t *testing.T, mgr mwanachamaagency.AgencyManager, roleID string, record agencymodels.Record, actions ...string) {
	t.Helper()
	ctx := context.Background()
	role, err := mgr.GetRole(ctx, roleID)
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	granted := slices.Clone(role.Permissions)
	for _, action := range actions {
		code := mwanachamaagency.RecordPermissionCode(record.Code, action, mwanachamaagency.RecordFieldStar)
		if action == agencymodels.RowActionDelete {
			code = mwanachamaagency.RecordPermissionCode(record.Code, action)
		}
		if !slices.Contains(granted, code) {
			granted = append(granted, code)
		}
	}
	if _, err := mgr.SetRolePermissions(ctx, roleID, granted); err != nil {
		t.Fatalf("SetRolePermissions: %v", err)
	}
}

func letRoleAdd(t *testing.T, mgr mwanachamaagency.AgencyManager, roleID string, record agencymodels.Record) {
	t.Helper()
	letRoleDo(t, mgr, roleID, record, agencymodels.RowActionAdd)
}

func addingRoleOf(t *testing.T, mgr mwanachamaagency.AgencyManager, draftID string, record agencymodels.Record) string {
	t.Helper()
	roles, err := mgr.ListRoles(context.Background(), draftID, mwanachamaagency.RoleFilter{})
	if err != nil {
		t.Fatalf("ListRoles: %v", err)
	}
	for _, role := range roles {
		if carriesRowAction(role.Permissions, record, agencymodels.RowActionAdd) {
			return role.ID
		}
	}
	t.Fatalf("no role of the draft adds rows to %s", record.Name)
	return ""
}
