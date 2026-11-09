package http

import (
	"net/http"
	"slices"
	"testing"
)

func groupRoleWalkWithTheRealPermissionLookup(t *testing.T) groupRoleWalk {
	t.Helper()
	w := newGroupRoleWalkBehindTheAccountRouter(t)
	w.deps.rolePermissionsOverride = nil
	return w
}

func roleCodesOf(t *testing.T, body map[string]any) []string {
	t.Helper()
	raw, _ := body["roles"].([]any)
	codes := make([]string, 0, len(raw))
	for _, item := range raw {
		entry, _ := item.(map[string]any)
		name, _ := entry["name"].(string)
		codes = append(codes, name)
	}
	slices.Sort(codes)
	return codes
}

func TestMyRoles_AResidentWhoseGroupHoldsARoleReadsTheirRolesThroughTheRealLookup(t *testing.T) {
	w := groupRoleWalkWithTheRealPermissionLookup(t)
	_, kofi := w.resident(t, "Kofi", "Support")
	w.giveRole(t, "Support", "Reader")

	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-roles", nil, kofi)
	if rec.Code != http.StatusOK {
		t.Fatalf("my-roles for a member of a group with a role: %d %s, want 200", rec.Code, rec.Body.String())
	}
	body := decodeObject(t, rec)
	if body["membership"] != "resident" {
		t.Fatalf("membership = %v, want resident", body["membership"])
	}
	if got := roleCodesOf(t, body); !slices.Equal(got, []string{"Reader"}) {
		t.Fatalf("roles = %v, want [Reader]", got)
	}
}

func TestMyRoles_AResidentWithNoRoleAnywhereGetsAnEmptyAnswerNotAnError(t *testing.T) {
	w := groupRoleWalkWithTheRealPermissionLookup(t)
	_, amina := w.resident(t, "Amina", "Support")
	_, yaw := w.resident(t, "Yaw")

	for name, as := range map[string]*http.Cookie{"in a group with no role": amina, "in no group": yaw} {
		rec := w.call(t, "GET", "/instances/"+w.instance+"/my-roles", nil, as)
		if rec.Code != http.StatusOK {
			t.Fatalf("my-roles for a resident %s: %d %s, want 200", name, rec.Code, rec.Body.String())
		}
		body := decodeObject(t, rec)
		if roles, _ := body["roles"].([]any); len(roles) != 0 {
			t.Fatalf("a resident %s holds roles %v, want none", name, roles)
		}
		if permissions, _ := body["permissions"].([]any); len(permissions) != 0 {
			t.Fatalf("a resident %s holds permissions %v, want none", name, permissions)
		}
	}
}
