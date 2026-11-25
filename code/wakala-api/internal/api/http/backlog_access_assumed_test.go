package http

import (
	"net/http"
	"slices"
	"testing"
	"time"
)

func (w groupRoleWalk) loginWithoutAGroup(t *testing.T, actorID string) *http.Cookie {
	t.Helper()
	s, err := w.deps.Sessions.Mint(t.Context(), actorID, time.Hour)
	if err != nil {
		t.Fatalf("mint session for %s: %v", actorID, err)
	}
	return &http.Cookie{Name: sessionCookieName, Value: s.Token}
}

func (w groupRoleWalk) backlogWith(t *testing.T, level string, groups ...string) {
	t.Helper()
	if rec := w.call(t, "PUT", w.tm("/backlog-owner-group"), map[string]any{"group_id": w.group(t, "Staff")}, w.owner); rec.Code != http.StatusNoContent {
		t.Fatalf("set owner group: %d %s", rec.Code, rec.Body.String())
	}
	for _, group := range groups {
		w.giveAccess(t, "backlog", w.group(t, group), level)
	}
}

func TestBacklogAccess_AGroupWithCanSeeSeesTheBacklogOnlyWhileItIsTheAssumedGroup(t *testing.T) {
	w := newGroupRoleWalk(t)
	id, kofi := w.resident(t, "Kofi", "Support", "Dev")
	w.backlogWith(t, "see", "Support")
	w.journeyIssue(t, "backlog", "to-do")

	w.assumeDirectly(t, kofi, id, w.group(t, "Support"))
	if got := w.visibleBacklogs(t, kofi); !slices.Equal(got, []string{"backlog"}) {
		t.Fatalf("acting as Support (Can see): backlogs %v, want the backlog", got)
	}
	if got := w.visibleIssues(t, kofi); got != 1 {
		t.Fatalf("acting as Support (Can see): issues %d, want 1", got)
	}

	w.assumeDirectly(t, kofi, id, w.group(t, "Dev"))
	if code := w.list(t, kofi); code != http.StatusForbidden {
		t.Fatalf("acting as Dev, a group with no access: list %d, want 403", code)
	}
}

func TestBacklogAccess_ACanMoveGroupMovesAnIssueAndAnotherGroupDoesNot(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, mover := w.resident(t, "Mia", "Support")
	_, looker := w.resident(t, "Lee", "Dev")
	w.backlogWith(t, "move", "Support")
	w.giveAccess(t, "backlog", w.group(t, "Dev"), "see")
	issue := w.journeyIssue(t, "backlog", "to-do")
	move := func(as *http.Cookie) int {
		return w.call(t, "POST", w.tm("/tasks/"+issue+"/move-to-step"), map[string]any{"backlog": "backlog", "step": "doing"}, as).Code
	}

	if code := move(looker); code != http.StatusForbidden {
		t.Fatalf("a Can see group moves an issue: %d, want 403", code)
	}
	if code := move(mover); code != http.StatusOK {
		t.Fatalf("a Can move group moves an issue: %d, want 200", code)
	}
}

func TestBacklogAccess_APersonWhoHasAssumedNoGroupReachesNoBacklog(t *testing.T) {
	w := newGroupRoleWalk(t)
	id, _ := w.resident(t, "Amina", "Support")
	w.backlogWith(t, "move", "Support")
	w.journeyIssue(t, "backlog", "to-do")
	loggedInAsNobody := w.loginWithoutAGroup(t, id)

	if code := w.list(t, loggedInAsNobody); code != http.StatusForbidden {
		t.Fatalf("with no assumed group: list %d, want 403", code)
	}
	if code := w.create(t, loggedInAsNobody); code != http.StatusForbidden {
		t.Fatalf("with no assumed group: create %d, want 403", code)
	}
}

func TestBacklogAccess_ADisabledGroupGivesNoAccessUntilItIsEnabled(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, amina := w.resident(t, "Amina", "Support")
	support := w.group(t, "Support")
	w.backlogWith(t, "move", "Support")
	groupPath := "/instances/" + w.instance + "/groups/" + support

	if code := w.create(t, amina); code != http.StatusCreated {
		t.Fatalf("an enabled Can move group creates: %d, want 201", code)
	}
	if rec := w.call(t, "POST", groupPath+"/disable", nil, w.ownerInFirstGroup(t)); rec.Code != http.StatusOK {
		t.Fatalf("disable the group: %d %s", rec.Code, rec.Body.String())
	}
	if code := w.list(t, amina); code != http.StatusForbidden {
		t.Fatalf("a disabled group lists: %d, want 403", code)
	}
	if code := w.create(t, amina); code != http.StatusForbidden {
		t.Fatalf("a disabled group creates: %d, want 403", code)
	}
	if rec := w.call(t, "POST", groupPath+"/enable", nil, w.ownerInFirstGroup(t)); rec.Code != http.StatusOK {
		t.Fatalf("enable the group: %d %s", rec.Code, rec.Body.String())
	}
	if code := w.create(t, amina); code != http.StatusCreated {
		t.Fatalf("an enabled again Can move group creates: %d, want 201", code)
	}
}

func TestBacklogAccess_GivingAndTakingAccessGivesAndTakesNoRole(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.backlogRoles(t)
	support := w.group(t, "Support")
	w.backlogWith(t, "move", "Support")
	if held := w.heldRoles(t, support); len(held) != 0 {
		t.Fatalf("after Can move the group holds the roles %v, want none", held)
	}
	if rec := w.call(t, "DELETE", w.tm("/backlogs/backlog/access/"+support), nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("take the access: %d %s", rec.Code, rec.Body.String())
	}
	if held := w.heldRoles(t, support); len(held) != 0 {
		t.Fatalf("after the access is taken the group holds the roles %v, want none", held)
	}
}
