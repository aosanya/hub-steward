package http

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"wakalaserver/internal/agencies"
)

func (w groupRoleWalk) setJoinMode(t *testing.T, group, mode string) {
	t.Helper()
	if _, err := w.directory(t).SetGroupJoinMode(context.Background(), w.group(t, group), mode); err != nil {
		t.Fatalf("SetGroupJoinMode %s %s: %v", group, mode, err)
	}
}

func (w groupRoleWalk) join(t *testing.T, group string, as *http.Cookie) int {
	t.Helper()
	return w.call(t, "POST", "/instances/"+w.instance+"/actor/groups/"+w.group(t, group)+"/join", map[string]any{}, as).Code
}

func TestOpenGroupRoles_AnOpenGroupCannotBeGivenARole(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, outsider := w.resident(t, "Outsider")
	group := w.group(t, "Dev")
	w.setJoinMode(t, "Dev", "open")

	rec := w.call(t, "POST", w.groupRolesPath(), map[string]any{"group_id": group, "agency_role_id": w.roles["Worker"]}, w.owner)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("give a role to an open group: %d %s, want 422", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "An open group cannot hold a role: anyone could join it. Make it invite-only first.") {
		t.Fatalf("the refusal says %s", rec.Body.String())
	}
	held, _ := w.deps.Registry.(agencies.GroupRoles).GroupRoleIDs(context.Background(), w.instance, group)
	if len(held) != 0 {
		t.Fatalf("the open group holds %v, want no role", held)
	}
	if code := w.join(t, "Dev", outsider); code != http.StatusOK {
		t.Fatalf("join the open group: %d, want 200", code)
	}
	if code := w.list(t, outsider); code != http.StatusNotFound {
		t.Fatalf("a resident who joined an open group lists tasks: %d, want 404", code)
	}
}

func TestOpenGroupRoles_SwitchingARoleGroupToOpenSuspendsTheRole(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, member := w.resident(t, "Kofi", "Dev")
	_, outsider := w.resident(t, "Outsider")
	w.giveRole(t, "Dev", "Worker")
	if code := w.create(t, member); code != http.StatusCreated {
		t.Fatalf("a member of the invite-only group creates a task: %d, want 201", code)
	}

	w.setJoinMode(t, "Dev", "open")
	if code := w.list(t, member); code != http.StatusNotFound {
		t.Fatalf("a member of the group once it is open lists tasks: %d, want 404", code)
	}
	if code := w.join(t, "Dev", outsider); code != http.StatusOK {
		t.Fatalf("join the open group: %d, want 200", code)
	}
	if code := w.list(t, outsider); code != http.StatusNotFound {
		t.Fatalf("a resident who joined the open group lists tasks: %d, want 404", code)
	}
	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-roles", nil, member)
	if raw, _ := decodeObject(t, rec)["permissions"].([]any); len(raw) != 0 {
		t.Fatalf("my-roles for a member of the open group lists %v, want none", raw)
	}

	w.setJoinMode(t, "Dev", "confirmed")
	if code := w.create(t, member); code != http.StatusCreated {
		t.Fatalf("after the group is invite-only again: %d, want 201", code)
	}
}

func TestOpenGroupRoles_BacklogAccessForAnOpenGroupGivesAccessButNoRole(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.backlogRoles(t)
	staff, support := w.group(t, "Staff"), w.group(t, "Support")
	_, amina := w.resident(t, "Amina", "Support")
	w.setJoinMode(t, "Support", "open")
	if rec := w.call(t, "PUT", w.tm("/backlog-owner-group"), map[string]any{"group_id": staff}, w.owner); rec.Code != http.StatusNoContent {
		t.Fatalf("set owner group: %d %s", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "PUT", w.tm("/backlogs/backlog/access/"+support), map[string]any{"level": "see"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("give Can see to an open group: %d %s", rec.Code, rec.Body.String())
	}
	held, _ := w.deps.Registry.(agencies.GroupRoles).GroupRoleIDs(context.Background(), w.instance, support)
	if len(held) != 0 {
		t.Fatalf("the open group holds %v after Can see, want no role", held)
	}
	got := w.access(t, "backlog", support)
	if got == nil || got["level"] != "see" || got["no_role"] != true {
		t.Fatalf("access entry for the open group = %v, want level see and no_role true", got)
	}
	if code := w.list(t, amina); code != http.StatusNotFound {
		t.Fatalf("a member of the open group lists tasks: %d, want 404", code)
	}
}
