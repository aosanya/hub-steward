package http

import (
	"net/http"
	"testing"
)

const riskReadPermission = "risk.read"

const riskReaderName = "Risk reader"

func (w groupRoleWalk) riskReaderRole(t *testing.T) {
	t.Helper()
	w.moduleRoles(t, riskModule, moduleRole{name: riskReaderName, permission: riskReadPermission})
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
