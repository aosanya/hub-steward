package http

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"testing"

	"wakalaserver/internal/agencies"
	mwanachamaactor "wakalaserver/modules/actor"
)

type journeyIssues struct {
	software string
	ops      string
}

func (w groupRoleWalk) journeyIssue(t *testing.T, backlog, step string) string {
	t.Helper()
	rec := w.call(t, "POST", w.tm("/tasks"), map[string]any{"title": "An issue in " + backlog}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("owner creates an issue: %d %s", rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	rec = w.call(t, "POST", w.tm("/tasks/"+id+"/move-to-step"), map[string]any{"backlog": backlog, "step": step}, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner places the issue in %s: %d %s", backlog, rec.Code, rec.Body.String())
	}
	return id
}

func (w groupRoleWalk) rename(t *testing.T, issue string, as *http.Cookie) int {
	t.Helper()
	rec := w.call(t, "PUT", w.tm("/tasks/"+issue), map[string]any{"title": "Renamed", "status": "pending", "priority": "medium"}, as)
	return rec.Code
}

func (w groupRoleWalk) giveAccess(t *testing.T, backlog, group, level string) {
	t.Helper()
	if rec := w.call(t, "PUT", w.tm("/backlogs/"+backlog+"/access/"+group), map[string]any{"level": level}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("give %s on %s: %d %s", level, backlog, rec.Code, rec.Body.String())
	}
}

func (w groupRoleWalk) visibleBacklogs(t *testing.T, as *http.Cookie) []string {
	t.Helper()
	rec := w.call(t, "GET", w.tm("/backlogs"), nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("list backlogs: %d %s", rec.Code, rec.Body.String())
	}
	var ids []string
	items, _ := decodeObject(t, rec)["items"].([]any)
	for _, item := range items {
		if m, ok := item.(map[string]any); ok {
			ids = append(ids, m["id"].(string))
		}
	}
	slices.Sort(ids)
	return ids
}

func (w groupRoleWalk) visibleIssues(t *testing.T, as *http.Cookie) int {
	t.Helper()
	rec := w.call(t, "GET", w.tm("/tasks"), nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("list issues: %d %s", rec.Code, rec.Body.String())
	}
	var items []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &items); err != nil {
		t.Fatalf("decode issues %q: %v", rec.Body.String(), err)
	}
	return len(items)
}

func (w groupRoleWalk) heldRoles(t *testing.T, group string) []string {
	t.Helper()
	ids, err := w.deps.Registry.(agencies.GroupRoles).GroupRoleIDs(context.Background(), w.instance, group)
	if err != nil {
		t.Fatalf("GroupRoleIDs: %v", err)
	}
	return ids
}

func TestJourney07_GroupRolesWalkedThroughTheRoutes(t *testing.T) {
	w := newGroupRoleWalk(t)
	member, worker := w.backlogRoles(t)
	staff, support, contributors := w.group(t, "Staff"), w.group(t, "Support"), w.group(t, "Contributors")
	aminaID, amina := w.resident(t, "Amina", "Support")
	if rec := w.call(t, "POST", w.tm("/backlogs"), map[string]any{"name": "Ops", "steps": []string{"Open", "Closed"}}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("create the Ops backlog: %d %s", rec.Code, rec.Body.String())
	}
	software := w.journeyIssue(t, "backlog", "to-do")
	ops := w.journeyIssue(t, "ops", "open")
	if rec := w.call(t, "PUT", w.tm("/backlog-owner-group"), map[string]any{"group_id": staff}, w.owner); rec.Code != http.StatusNoContent {
		t.Fatalf("set the owner group: %d %s", rec.Code, rec.Body.String())
	}

	if code := w.list(t, amina); code != http.StatusNotFound {
		t.Fatalf("step 1, a member of a group with no role lists issues: %d, want 404", code)
	}
	if code := w.create(t, amina); code != http.StatusNotFound {
		t.Fatalf("step 1, a member of a group with no role creates an issue: %d, want 404", code)
	}
	if code := w.list(t, w.owner); code != http.StatusOK {
		t.Fatalf("step 1, the owner lists issues: %d, want 200", code)
	}

	body := map[string]any{"group_id": support, "agency_role_id": member}
	if rec := w.call(t, "POST", w.groupRolesPath(), body, amina); rec.Code != http.StatusNotFound {
		t.Fatalf("step 2, a person who is not the owner gives a group role: %d, want 404", rec.Code)
	}
	if rec := w.call(t, "POST", w.groupRolesPath(), body, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("step 2, the owner gives Support the Backlog member role: %d %s", rec.Code, rec.Body.String())
	}

	if code := w.list(t, amina); code != http.StatusOK {
		t.Fatalf("step 3, a role and no shared backlog: list %d, want 200", code)
	}
	if got := w.visibleBacklogs(t, amina); len(got) != 0 {
		t.Fatalf("step 3, backlogs listed with no access given: %v, want none", got)
	}
	if got := w.visibleIssues(t, amina); got != 0 {
		t.Fatalf("step 3, issues listed with no access given: %d, want 0", got)
	}

	w.giveAccess(t, "backlog", support, "see")
	w.giveAccess(t, "ops", support, "see")
	if got := w.heldRoles(t, support); !slices.Equal(got, []string{member}) {
		t.Fatalf("step 4, Support holds %v after Can see, want only %s", got, member)
	}
	if rec := w.call(t, "DELETE", w.tm("/backlogs/ops/access/"+support), nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("step 4, take Can see on Ops away again: %d", rec.Code)
	}
	if got := w.visibleBacklogs(t, amina); !slices.Equal(got, []string{"backlog"}) {
		t.Fatalf("step 4, backlogs Amina sees: %v, want only the one Support has access to", got)
	}
	if got := w.visibleIssues(t, amina); got != 1 {
		t.Fatalf("step 4, issues Amina sees: %d, want only the one in the shared backlog", got)
	}
	if code := w.create(t, amina); code != http.StatusForbidden {
		t.Fatalf("step 4, Can see creates an issue: %d, want 403", code)
	}
	if code := w.rename(t, software, amina); code != http.StatusForbidden {
		t.Fatalf("step 4, Can see changes an issue: %d, want 403", code)
	}
	w.giveAccess(t, "ops", support, "see")

	w.giveAccess(t, "backlog", contributors, "move")
	if got := w.heldRoles(t, contributors); !slices.Equal(got, []string{worker}) {
		t.Fatalf("step 5, Contributors holds %v after Can move, want only %s", got, worker)
	}
	if _, err := w.directory(t).AssignGroup(context.Background(), mwanachamaactor.ActorGroupAssignment{ActorID: aminaID, GroupID: contributors}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
	if code := w.rename(t, software, amina); code != http.StatusOK {
		t.Fatalf("step 5, Can move through her other group changes an issue: %d, want 200", code)
	}
	if code := w.rename(t, ops, amina); code != http.StatusForbidden {
		t.Fatalf("step 5, a backlog where only Support has Can see: %d, want 403", code)
	}

	_, kofi := w.resident(t, "Kofi", "Support")
	w.giveAccess(t, "backlog", support, "move")
	if err := w.deps.Registry.(agencies.GroupRoles).TakeGroupRole(context.Background(), w.instance, support, worker); err != nil {
		t.Fatalf("TakeGroupRole: %v", err)
	}
	if rec := w.call(t, "POST", w.groupRolesPath(), body, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("step 6, the owner gives Support the Backlog member role again: %d", rec.Code)
	}
	if entry := w.access(t, "backlog", support); entry == nil || entry["role_too_small"] != true {
		t.Fatalf("step 6, Support's access entry = %v, want role_too_small", entry)
	}
	if code := w.list(t, kofi); code != http.StatusOK {
		t.Fatalf("step 6, a read-only role with Can move lists: %d, want 200", code)
	}
	if code := w.rename(t, software, kofi); code != http.StatusForbidden {
		t.Fatalf("step 6, a read-only role with Can move changes an issue: %d, want 403", code)
	}
	if rec := w.call(t, "POST", w.groupRolesPath(), map[string]any{"group_id": support, "agency_role_id": worker}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("step 6, the owner gives Support the Backlog worker role: %d", rec.Code)
	}
	if code := w.rename(t, software, kofi); code != http.StatusOK {
		t.Fatalf("step 6, the worker role with Can move changes an issue: %d, want 200", code)
	}
	if code := w.rename(t, ops, kofi); code != http.StatusForbidden {
		t.Fatalf("step 6, the worker role with only Can see on Ops changes an issue: %d, want 403", code)
	}

	for _, backlog := range []string{"backlog", "ops"} {
		if rec := w.call(t, "DELETE", w.tm("/backlogs/"+backlog+"/access/"+support), nil, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("step 7, take Support's access to %s away: %d %s", backlog, rec.Code, rec.Body.String())
		}
	}
	if got := w.heldRoles(t, support); len(got) != 0 {
		t.Fatalf("step 7, Support still holds %v after its last access was taken away", got)
	}
	if code := w.list(t, kofi); code != http.StatusNotFound {
		t.Fatalf("step 7, a member of Support after the access and role are gone: %d, want 404", code)
	}
	if code := w.list(t, amina); code != http.StatusOK {
		t.Fatalf("step 7, Amina still has Contributors: %d, want 200", code)
	}
	if _, _, err := w.directory(t).Deregister(context.Background(), aminaID, contributors); err != nil {
		t.Fatalf("Deregister: %v", err)
	}
	if code := w.list(t, amina); code != http.StatusNotFound {
		t.Fatalf("step 7, Amina after leaving Contributors: %d, want 404", code)
	}
}
