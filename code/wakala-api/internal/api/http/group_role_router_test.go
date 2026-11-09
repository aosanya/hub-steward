package http

import (
	"context"
	"net/http"
	"testing"

	"wakalaserver/internal/accounts"
)

func newGroupRoleWalkBehindTheAccountRouter(t *testing.T) groupRoleWalk {
	t.Helper()
	w := newGroupRoleWalk(t)
	noOwnDatabase := func(context.Context, string) (accounts.Connection, bool, error) {
		return accounts.Connection{}, false, nil
	}
	w.deps.Registry = accounts.NewRouter(w.deps.Registry, noOwnDatabase, nil, 4)
	return w
}

func TestGroupRolesBehindTheAccountRouter_TheOwnerGivesTheRoleAndTheGroupIsAdmitted(t *testing.T) {
	w := newGroupRoleWalkBehindTheAccountRouter(t)
	_, amina := w.resident(t, "Amina", "Support")
	group := w.group(t, "Support")

	if code := w.list(t, amina); code != http.StatusNotFound {
		t.Fatalf("before the role is given: %d, want 404", code)
	}
	rec := w.call(t, "POST", w.groupRolesPath(), map[string]any{"group_id": group, "agency_role_id": w.roles["Reader"]}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("owner gives the role through the router: %d %s", rec.Code, rec.Body.String())
	}
	if code := w.list(t, amina); code != http.StatusOK {
		t.Fatalf("after the role is given, a member of the group lists tasks through the router: %d, want 200", code)
	}
	rec = w.call(t, "GET", w.groupRolesPath()+"?group_id="+group, nil, w.owner)
	if items, _ := decodeObject(t, rec)["items"].([]any); rec.Code != http.StatusOK || len(items) != 1 {
		t.Fatalf("list the group's roles through the router: %d %s", rec.Code, rec.Body.String())
	}
	rec = w.call(t, "DELETE", w.groupRolesPath()+"/"+group+"/"+w.roles["Reader"], nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner takes the role through the router: %d %s", rec.Code, rec.Body.String())
	}
	if code := w.list(t, amina); code != http.StatusNotFound {
		t.Fatalf("after the role is taken: %d, want 404", code)
	}
}
