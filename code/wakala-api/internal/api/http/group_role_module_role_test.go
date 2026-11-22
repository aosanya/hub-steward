package http

import (
	"context"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type moduleRole struct {
	name       string
	permission string
}

func (w groupRoleWalk) moduleRoles(t *testing.T, module string, roles ...moduleRole) {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	mods, err := mgr.ListModules(ctx, w.draftID, mwanachamaagency.ModuleFilter{})
	if err != nil {
		t.Fatalf("ListModules: %v", err)
	}
	for _, m := range mods {
		if m.Code == module {
			if _, err := mgr.SetModuleEnabled(ctx, w.draftID, m.ID, true); err != nil {
				t.Fatalf("SetModuleEnabled: %v", err)
			}
		}
	}
	granted := map[string][]string{}
	for _, r := range roles {
		role, err := mgr.CreateRole(ctx, agencymodels.Role{DraftID: w.draftID, Name: r.name, Permissions: []string{r.permission}})
		if err != nil {
			t.Fatalf("CreateRole: %v", err)
		}
		w.roles[r.name] = role.ID
		granted[role.ID] = []string{r.permission}
	}
	w.publish(t)
	agencyMountedSets.forget(w.instance)
	before := w.deps.rolePermissionsOverride
	w.deps.rolePermissionsOverride = func(ctx context.Context, roleID string) ([]string, error) {
		if codes, ok := granted[roleID]; ok {
			return codes, nil
		}
		return before(ctx, roleID)
	}
}
