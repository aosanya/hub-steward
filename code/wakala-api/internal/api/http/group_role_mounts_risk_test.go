package http

import (
	"context"
	"net/http"
	"strings"
	"testing"
)

func (w groupRoleWalk) mountsAs(t *testing.T, as *http.Cookie) (int, string) {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/mounts", nil, as)
	return rec.Code, rec.Body.String()
}

func TestGroupRoleMounts_ACouncilRiskReaderSeesTheRisksModuleWhenTheRoleHoldsMountList(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.riskReaderRole(t)
	before := w.deps.rolePermissionsOverride
	w.deps.rolePermissionsOverride = func(ctx context.Context, roleID string) ([]string, error) {
		if roleID == w.roles[riskReaderName] {
			return []string{riskReadPermission, "mount.list"}, nil
		}
		return before(ctx, roleID)
	}
	_, reader := w.resident(t, "Reader", "Analysts")
	w.giveRole(t, "Analysts", riskReaderName)
	code, body := w.mountsAs(t, reader)
	if code != http.StatusOK {
		t.Fatalf("a resident whose role holds risk.read and mount.list reads the mounts: %d %s", code, body)
	}
	if !strings.Contains(body, `"module":"`+riskModule+`"`) {
		t.Fatalf("the mounts hold no %s module: %s", riskModule, body)
	}
}

func TestGroupRoleMounts_ACouncilRiskReaderWhoseRoleLacksMountListIsRefusedTheMounts(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.riskReaderRole(t)
	_, reader := w.resident(t, "Reader", "Analysts")
	w.giveRole(t, "Analysts", riskReaderName)
	if code, body := w.mountsAs(t, reader); code != http.StatusNotFound {
		t.Fatalf("a resident whose role holds only risk.read reads the mounts: %d %s, want 404", code, body)
	}
}
