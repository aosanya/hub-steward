package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

const riskReadPermission = "risk.read"

const riskReaderName = "Risk reader"

func (w groupRoleWalk) riskReaderRole(t *testing.T) {
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
		if m.Code == riskModule {
			if _, err := mgr.SetModuleEnabled(ctx, w.draftID, m.ID, true); err != nil {
				t.Fatalf("SetModuleEnabled: %v", err)
			}
		}
	}
	role, err := mgr.CreateRole(ctx, agencymodels.Role{DraftID: w.draftID, Name: riskReaderName, Permissions: []string{riskReadPermission}})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	w.roles[riskReaderName] = role.ID
	w.publish(t)
	agencyMountedSets.forget(w.instance)
	before := w.deps.rolePermissionsOverride
	w.deps.rolePermissionsOverride = func(ctx context.Context, roleID string) ([]string, error) {
		if roleID == role.ID {
			return []string{riskReadPermission}, nil
		}
		return before(ctx, roleID)
	}
}

func (w groupRoleWalk) listRisks(t *testing.T, as *http.Cookie) int {
	t.Helper()
	return w.call(t, "GET", "/instances/"+w.instance+"/risks/risks", nil, as).Code
}

func TestGroupRoleRisk_AResidentInAGroupHoldingTheRiskReadPermissionListsRisks(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.riskReaderRole(t)
	_, amina := w.resident(t, "Amina", "Analysts")
	w.giveRole(t, "Analysts", riskReaderName)
	rec := w.call(t, "GET", "/instances/"+w.instance+"/risks/risks", nil, amina)
	if rec.Code != http.StatusOK {
		t.Fatalf("a resident in a group holding the risk read permission lists risks: %d %s, want 200", rec.Code, rec.Body.String())
	}
}

func TestGroupRoleRisk_AResidentWithNoRoleListsNoRisks(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.riskReaderRole(t)
	_, amina := w.resident(t, "Amina", "Analysts")
	if code := w.listRisks(t, amina); code != http.StatusForbidden {
		t.Fatalf("a resident whose group holds no role lists risks: %d, want 403", code)
	}
	if code := w.listRisks(t, w.owner); code != http.StatusOK {
		t.Fatalf("the owner lists risks: %d, want 200", code)
	}
}

func TestGroupRoleRisk_AResidentHoldingOnlyTheRiskReadPermissionCannotWriteRisks(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.riskReaderRole(t)
	_, amina := w.resident(t, "Amina", "Analysts")
	w.giveRole(t, "Analysts", riskReaderName)
	body := map[string]any{"title": "Bridge flooding", "top_event": "River floods the footbridge"}
	rec := w.call(t, "POST", "/instances/"+w.instance+"/risks/risks", body, amina)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("a resident holding only the risk read permission writes a risk: %d %s, want 403", rec.Code, rec.Body.String())
	}
}
