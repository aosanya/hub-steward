package http

import (
	"context"
	"slices"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

const harnessOwnerRole = "Harness owner"

var everyRowCode = []string{"add." + mwanachamaagency.RecordFieldStar, "edit." + mwanachamaagency.RecordFieldStar, "view." + mwanachamaagency.RecordFieldStar, "delete"}

func recordCode(record agencymodels.Record, kind string) string {
	action, field, _ := splitCodeKind(kind)
	if field == "" {
		return mwanachamaagency.RecordPermissionCode(record.Code, action)
	}
	return mwanachamaagency.RecordPermissionCode(record.Code, action, field)
}

func splitCodeKind(kind string) (string, string, bool) {
	for i := 0; i < len(kind); i++ {
		if kind[i] == '.' {
			return kind[:i], kind[i+1:], true
		}
	}
	return kind, "", false
}

func (w stepRunWalk) draftRecords(t *testing.T) []agencymodels.Record {
	t.Helper()
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	records, err := mgr.ListRecords(context.Background(), w.draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	return records
}

func (w stepRunWalk) giveRole(t *testing.T, role string, record agencymodels.Record, kinds ...string) {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	have, err := mgr.GetRole(ctx, w.roles[role])
	if err != nil {
		t.Fatalf("GetRole %s: %v", role, err)
	}
	for _, kind := range kinds {
		code := recordCode(record, kind)
		if !slices.Contains(have.Permissions, code) {
			have.Permissions = append(have.Permissions, code)
		}
	}
	if _, err := mgr.UpdateRole(ctx, have); err != nil {
		t.Fatalf("UpdateRole %s with %v: %v", role, kinds, err)
	}
}

func (w stepRunWalk) grantTheHarnessCodes(t *testing.T) {
	t.Helper()
	if w.draftID == "" {
		return
	}
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	if err := (rolesPublished{AgencyManager: mgr, instanceID: w.instance}).ensureStepRecords(ctx, w.draftID); err != nil {
		t.Fatalf("ensureStepRecords: %v", err)
	}
	steps, err := mgr.ListWorkItems(ctx, w.draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		t.Fatalf("ListWorkItems: %v", err)
	}
	records := w.draftRecords(t)
	names := stepRecordNames(steps)
	for _, step := range steps {
		if !stepKeepsRecord(step) {
			continue
		}
		record, found := recordOfStep(records, step, names[step.ID])
		if !found {
			continue
		}
		for name, id := range w.roles {
			if id == stepActorRoleID(step) && !w.withheld[name] {
				w.giveRole(t, name, record, "add."+mwanachamaagency.RecordFieldStar, "view."+mwanachamaagency.RecordFieldStar)
			}
		}
	}
	if _, present := w.roles[harnessOwnerRole]; !present {
		return
	}
	for _, record := range records {
		w.giveRole(t, harnessOwnerRole, record, everyRowCode...)
	}
}

func (w stepRunWalk) holdingBesidesTheirPublishedCodes(held map[string][]string) {
	w.deps.rolePermissionsOverride = func(ctx context.Context, roleID string) ([]string, error) {
		published, _ := w.deps.cachedRolePermissions(withPartitionContext(ctx, w.instance), roleID)
		return append(published, held[roleID]...), nil
	}
}
