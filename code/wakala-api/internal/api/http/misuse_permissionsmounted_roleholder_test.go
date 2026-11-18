package http

import (
	"context"
	"net/http"
	"testing"
)

func roleHolderWithPermissionsMounted(t *testing.T, codes ...string) (changeTarget, *http.Cookie) {
	t.Helper()
	w := newChangeTarget(t)
	runsModules(t, w.instance, "forms")
	held := map[string][]string{w.roles["Volunteer"]: codes}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		return held[roleID], nil
	}
	w.seatThroughAGroupRole(t)
	w.handler = mountPermissionsAndReports(t, w.deps)
	return w, w.cookieFor(t, w.volunteer)
}

func TestPermissionsMounted_RoleHolderIsAdmittedFromTheTemplatePermissions(t *testing.T) {
	w, holder := roleHolderWithPermissionsMounted(t, "service.edit")
	entry := map[string]any{"name": "t", "doc": `{"body":"x"}`, "visibility": "pending"}
	if rec := w.call(t, "PUT", "/reports/entries/holder-entry", entry, holder); rec.Code >= 300 {
		t.Errorf("role holder with service.edit writing a report entry: %d %s, want 2xx", rec.Code, rec.Body.String())
	}
}

func TestPermissionsMounted_RoleHolderWithoutThePermissionIsRefused(t *testing.T) {
	w, holder := roleHolderWithPermissionsMounted(t, "service.read")
	entry := map[string]any{"name": "t", "doc": `{"body":"x"}`, "visibility": "pending"}
	if rec := w.call(t, "PUT", "/reports/entries/holder-entry", entry, holder); rec.Code < 400 {
		t.Errorf("role holder with only service.read writing a report entry: %d %s, want refused", rec.Code, rec.Body.String())
	}
}
