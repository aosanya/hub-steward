package http

import (
	"context"
	"net/http"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

const caseVotePermission = "case.vote"

type catalogVoteWalk struct {
	taskAuthorWalk
	caseID string
}

func newCatalogVoteWalk(t *testing.T) catalogVoteWalk {
	t.Helper()
	w := newTaskAuthorWalk(t)
	permissionsAllow = catalogOnlyAllow
	perms := map[string][]string{
		w.roles["Volunteer"]: {taskReadPermission, caseVotePermission},
		w.roles["Liaison"]:   {taskReadPermission},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		return perms[roleID], nil
	}
	return catalogVoteWalk{taskAuthorWalk: w, caseID: w.openCase(t)}
}

func catalogOnlyAllow(codes []string, action string) bool {
	return allowedActions(codes)[action]
}

func (w catalogVoteWalk) vote(t *testing.T, as *http.Cookie) int {
	t.Helper()
	return w.call(t, "POST", w.tm()+"/cases/"+w.caseID+"/votes", map[string]any{}, as).Code
}

func (w catalogVoteWalk) listVotes(t *testing.T, as *http.Cookie) int {
	t.Helper()
	return w.call(t, "GET", w.tm()+"/cases/"+w.caseID+"/votes", nil, as).Code
}

func (w catalogVoteWalk) takeBack(t *testing.T, as *http.Cookie, member string) int {
	t.Helper()
	return w.call(t, "DELETE", w.tm()+"/cases/"+w.caseID+"/votes/"+member, nil, as).Code
}

func TestCatalogCaseVote_TheCatalogHoldsTheThreeVoteActions(t *testing.T) {
	p, ok := agencymodels.LookupPermission(caseVotePermission)
	if !ok {
		t.Fatalf("no catalog permission %q", caseVotePermission)
	}
	for _, action := range []string{caseVoteAction, takeBackVoteAction, "taskmanager.case.list_votes"} {
		found := false
		for _, a := range p.Actions {
			found = found || a == action
		}
		if !found {
			t.Fatalf("%s does not hold %s: %v", caseVotePermission, action, p.Actions)
		}
	}
}

func TestCatalogCaseVote_ARoleHoldingThePermissionVotesAndARoleWithoutItIsRefused(t *testing.T) {
	w := newCatalogVoteWalk(t)
	if code := w.vote(t, w.people["Liaison"]); code != http.StatusForbidden {
		t.Fatalf("a role without %s votes: %d, want 403", caseVotePermission, code)
	}
	if code := w.vote(t, w.people["Volunteer"]); code != http.StatusOK {
		t.Fatalf("a role with %s votes: %d, want 200", caseVotePermission, code)
	}
	if code := w.listVotes(t, w.people["Liaison"]); code != http.StatusForbidden {
		t.Fatalf("a role without %s lists the votes: %d, want 403", caseVotePermission, code)
	}
	if code := w.listVotes(t, w.people["Volunteer"]); code != http.StatusOK {
		t.Fatalf("a role with %s lists the votes: %d, want 200", caseVotePermission, code)
	}
}

func TestCatalogCaseVote_TakingABackVoteNeedsThePermissionAndStillOnlyTheMembersOwnOrTheOwners(t *testing.T) {
	w := newCatalogVoteWalk(t)
	if code := w.vote(t, w.people["Volunteer"]); code != http.StatusOK {
		t.Fatalf("a role with %s votes: %d, want 200", caseVotePermission, code)
	}
	voter, _ := w.storedVotes(t, w.caseID)[0]["member_id"].(string)
	if code := w.takeBack(t, w.people["Liaison"], voter); code < 400 || code >= 500 {
		t.Fatalf("a role without the permission withdraws another's vote: %d, want 4xx", code)
	}
	if len(w.storedVotes(t, w.caseID)) != 1 {
		t.Fatalf("the vote did not stay")
	}
	if code := w.takeBack(t, w.people["Volunteer"], voter); code != http.StatusOK {
		t.Fatalf("a member takes back their own vote: %d, want 200", code)
	}
	if code := w.vote(t, w.people["Volunteer"]); code != http.StatusOK {
		t.Fatalf("vote again: %d, want 200", code)
	}
	if code := w.takeBack(t, w.owner, voter); code != http.StatusOK {
		t.Fatalf("the owner withdraws a member's vote: %d, want 200", code)
	}
}
