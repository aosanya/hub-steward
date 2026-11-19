package http

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"testing"

	mwanachamapermissions "github.com/aosanya/mwanachama-backend-permissions"
)

type residentBaselinePermissions struct {
	mwanachamapermissions.PermissionsManager
}

func (residentBaselinePermissions) ActionsAnywhere(context.Context, string) ([]string, error) {
	return everyResidentAction(), nil
}

func (w groupRoleWalk) mountedModulesAs(t *testing.T, as *http.Cookie) []string {
	t.Helper()
	code, body := w.mountsAs(t, as)
	if code != http.StatusOK {
		t.Fatalf("the mounts: %d %s, want 200", code, body)
	}
	var view agencyMountsView
	if err := json.Unmarshal([]byte(body), &view); err != nil {
		t.Fatalf("the mounts are not json: %v %s", err, body)
	}
	modules := []string{}
	for _, m := range view.Modules {
		modules = append(modules, m.Module)
	}
	return modules
}

func (w groupRoleWalk) councilRiskReader(t *testing.T) *http.Cookie {
	t.Helper()
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
	return reader
}

func TestGroupRoleMounts_ARoleHoldingMountListAndRiskReadSeesOnlyTheModulesItMayOpen(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.deps.Permissions = residentBaselinePermissions{}
	reader := w.councilRiskReader(t)
	if got := w.mountedModulesAs(t, reader); !slices.Equal(got, []string{riskModule}) {
		t.Fatalf("a role holding mount.list and risk.read is shown the modules %v, want only [%s]", got, riskModule)
	}
}

func TestGroupRoleMounts_ARoleHoldingMountListAndRiskReadIsNotShownTheModulesOfOtherPermissions(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.deps.Permissions = residentBaselinePermissions{}
	reader := w.councilRiskReader(t)
	got := w.mountedModulesAs(t, reader)
	for _, module := range []string{"actor", "comm", "forms", "taskmanager"} {
		if slices.Contains(got, module) {
			t.Errorf("the mounts show %s to a role holding only mount.list and risk.read: %v", module, got)
		}
	}
}
