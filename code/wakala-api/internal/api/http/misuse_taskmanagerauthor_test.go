package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"wakalaserver/internal/agencies"
)

const (
	forgedVoter     = "forged-neighbour"
	forgedCanceller = "forged-coordinator"
	agentClerk      = "agent-clerk"
)

type taskAuthorWalk struct {
	stepRunWalk
	agent *http.Cookie
}

func newTaskAuthorWalk(t *testing.T) taskAuthorWalk {
	t.Helper()
	w := runEngineWalk(t)
	w.deps.rolePermissionsOverride = func(context.Context, string) ([]string, error) {
		return []string{taskReadPermission, caseVotePermission}, nil
	}
	allowed := permissionsAllow
	permissionsAllow = func(codes []string, action string) bool {
		if action == "taskmanager.workflow_run.cancel" {
			return slices.Contains(codes, taskReadPermission)
		}
		return allowed(codes, action)
	}
	t.Cleanup(func() { permissionsAllow = allowed })
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, agentClerk, agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember agent: %v", err)
	}
	seat := w.call(t, "PUT", "/instances/"+w.instance+"/members/"+agentClerk+"/agency-role", map[string]any{"agency_role_id": w.roles["Volunteer"]}, w.owner)
	if seat.Code != http.StatusOK {
		t.Fatalf("owner seats the agent: %d %s", seat.Code, seat.Body.String())
	}
	return taskAuthorWalk{stepRunWalk: w, agent: w.cookieFor(t, agentClerk)}
}

func (w taskAuthorWalk) tm() string { return "/instances/" + w.instance + "/taskmanager" }

func (w taskAuthorWalk) openCase(t *testing.T) string {
	t.Helper()
	rec := w.call(t, "POST", w.tm()+"/cases", map[string]any{"title": "Mend the bench"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("owner opens a case: %d %s", rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return id
}

func (w taskAuthorWalk) storedVotes(t *testing.T, caseID string) []map[string]any {
	t.Helper()
	rec := w.call(t, "GET", w.tm()+"/cases/"+caseID+"/votes", nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner lists the votes: %d %s", rec.Code, rec.Body.String())
	}
	return decodeObjects(t, rec)
}

func TestTaskmanagerAuthor_AResidentsVoteCountsForTheResidentNotForTheMemberTheBodyNames(t *testing.T) {
	w := newTaskAuthorWalk(t)
	caseID := w.openCase(t)
	rec := w.call(t, "POST", w.tm()+"/cases/"+caseID+"/votes", map[string]any{"member_id": forgedVoter}, w.people["Volunteer"])
	if rec.Code != http.StatusOK {
		t.Fatalf("resident votes with a forged member_id: %d %s, want 200", rec.Code, rec.Body.String())
	}
	votes := w.storedVotes(t, caseID)
	if len(votes) != 1 {
		t.Fatalf("stored votes = %v, want the resident's one", votes)
	}
	if votes[0]["member_id"] == forgedVoter || votes[0]["member_id"] != votes[0]["cast_by"] {
		t.Fatalf("the vote counts for %v though cast by %v, want the resident for both", votes[0]["member_id"], votes[0]["cast_by"])
	}
}

func TestTaskmanagerAuthor_AResidentCannotStuffTheBallotWithOtherMembersVotes(t *testing.T) {
	w := newTaskAuthorWalk(t)
	caseID := w.openCase(t)
	for _, name := range []string{"neighbour-1", "neighbour-2", "neighbour-3"} {
		w.call(t, "POST", w.tm()+"/cases/"+caseID+"/votes", map[string]any{"member_id": name}, w.people["Volunteer"])
	}
	if votes := w.storedVotes(t, caseID); len(votes) != 1 {
		t.Fatalf("one resident's three casts left %d stored votes, want 1", len(votes))
	}
}

func TestTaskmanagerAuthor_AnAgentCannotVoteForAMember(t *testing.T) {
	w := newTaskAuthorWalk(t)
	caseID := w.openCase(t)
	rec := w.call(t, "POST", w.tm()+"/cases/"+caseID+"/votes", map[string]any{"member_id": forgedVoter, "member_kind": "member"}, w.agent)
	if rec.Code < 400 || rec.Code >= 500 {
		t.Fatalf("agent votes for a member: %d %s, want 4xx", rec.Code, rec.Body.String())
	}
	if votes := w.storedVotes(t, caseID); len(votes) != 0 {
		t.Fatalf("stored votes = %v, want none", votes)
	}
}

func (w taskAuthorWalk) startedRun(t *testing.T) string {
	t.Helper()
	published := publishedReferralOf(t, w.stepRunWalk)
	code, run := w.startRun(t, w.owner, published.workflow, published.version)
	if code != http.StatusCreated {
		t.Fatalf("owner starts a run: %d", code)
	}
	moved := w.call(t, "PUT", w.tm()+"/workflow-runs/"+run+"/status", map[string]any{"new_status": "in_progress"}, w.owner)
	if moved.Code != http.StatusOK {
		t.Fatalf("owner moves the run to in_progress: %d %s", moved.Code, moved.Body.String())
	}
	return run
}

func (w taskAuthorWalk) cancelRun(t *testing.T, as *http.Cookie, run string) *httptest.ResponseRecorder {
	t.Helper()
	deadline := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	return w.call(t, "POST", w.tm()+"/workflow-runs/"+run+"/cancel", map[string]any{
		"reason": "stop", "cancelled_by": forgedCanceller, "quiesce_deadline": deadline,
	}, as)
}

func TestTaskmanagerAuthor_ACancelledRunNamesTheOwnerWhoCancelledItNotTheBody(t *testing.T) {
	w := newTaskAuthorWalk(t)
	run := w.startedRun(t)
	rec := w.cancelRun(t, w.owner, run)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner cancels the run: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if named, _ := decodeObject(t, rec)["cancelled_by"].(string); named != "test-owner" {
		t.Fatalf("the run names %q as its canceller, want test-owner", named)
	}
}

func TestTaskmanagerAuthor_ACancelledRunNamesTheAgentWhoCancelledItNotTheBody(t *testing.T) {
	w := newTaskAuthorWalk(t)
	run := w.startedRun(t)
	rec := w.cancelRun(t, w.agent, run)
	if rec.Code >= 300 {
		return
	}
	if named, _ := decodeObject(t, rec)["cancelled_by"].(string); named != agentClerk {
		t.Fatalf("the run names %q as its canceller, want %s", named, agentClerk)
	}
}
