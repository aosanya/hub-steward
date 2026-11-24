package http

import (
	"context"
	"slices"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func (w stepRunWalk) viewingEveryFieldUnlessSet() {
	if w.deps.rolePermissionsOverride == nil {
		w.everyRoleViewsEveryField()
	}
}

func (w stepRunWalk) everyRoleViewsEveryField() {
	deps := w.deps
	deps.rolePermissionsOverride = func(ctx context.Context, roleID string) ([]string, error) {
		granted, err := deps.cachedRolePermissions(ctx, roleID)
		if err != nil {
			return nil, err
		}
		m, err := deps.Registry.AgencyManager(ctx, partitionOf(ctx))
		if err != nil {
			return nil, err
		}
		draftID, err := liveDraftOf(ctx, m)
		if err != nil {
			return granted, nil
		}
		records, err := m.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
		if err != nil {
			return nil, err
		}
		for _, r := range records {
			granted = append(granted, mwanachamaagency.RecordPermissionCode(r.Code, mwanachamaagency.RecordViewAction, mwanachamaagency.RecordFieldStar))
		}
		return granted, nil
	}
}

func (w stepRunWalk) viewCode(t *testing.T, form, prompt string) string {
	t.Helper()
	ctx := context.Background()
	m, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	draftID, err := liveDraftOf(ctx, m)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	records, err := m.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	for _, r := range records {
		if r.Name != form {
			continue
		}
		if prompt == "" {
			return mwanachamaagency.RecordPermissionCode(r.Code, mwanachamaagency.RecordViewAction, mwanachamaagency.RecordFieldStar)
		}
		at := slices.IndexFunc(r.Questions, func(q agencymodels.StepQuestion) bool { return q.Prompt == prompt })
		if at < 0 {
			t.Fatalf("the record %q has no field %q", form, prompt)
		}
		return mwanachamaagency.RecordPermissionCode(r.Code, mwanachamaagency.RecordViewAction, r.Questions[at].Code)
	}
	t.Fatalf("no record named %q", form)
	return ""
}

func (w stepRunWalk) holdingOnly(roleName string, codes ...string) {
	w.viewingEveryFieldUnlessSet()
	before := w.deps.rolePermissionsOverride
	w.deps.rolePermissionsOverride = func(ctx context.Context, roleID string) ([]string, error) {
		if roleID == w.roles[roleName] {
			return slices.Clone(codes), nil
		}
		return before(ctx, roleID)
	}
}
