package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"wakalaserver/internal/agencies"
	taskmanagerroutes "wakalaserver/modules/taskmanager/routes"
)

type voteWithdrawalWalk struct {
	taskAuthorWalk
	caseID string
	victim string
}

func newVoteWithdrawalWalk(t *testing.T) voteWithdrawalWalk {
	t.Helper()
	w := newTaskAuthorWalk(t)
	allowed := permissionsAllow
	permissionsAllow = func(codes []string, action string) bool {
		if action == takeBackVoteAction {
			return slices.Contains(codes, taskReadPermission)
		}
		return allowed(codes, action)
	}
	t.Cleanup(func() { permissionsAllow = allowed })
	caseID := w.openCase(t)
	if rec := w.call(t, "POST", w.tm()+"/cases/"+caseID+"/votes", map[string]any{}, w.people["Volunteer"]); rec.Code != http.StatusOK {
		t.Fatalf("resident votes: %d %s", rec.Code, rec.Body.String())
	}
	votes := w.storedVotes(t, caseID)
	if len(votes) != 1 {
		t.Fatalf("stored votes = %v, want the resident's one", votes)
	}
	victim, _ := votes[0]["member_id"].(string)
	return voteWithdrawalWalk{taskAuthorWalk: w, caseID: caseID, victim: victim}
}

func (w voteWithdrawalWalk) takeBack(t *testing.T, as *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	return w.call(t, "DELETE", w.tm()+"/cases/"+w.caseID+"/votes/"+w.victim, nil, as)
}

func TestTakeBackVote_AResidentCannotWithdrawAnotherMembersVote(t *testing.T) {
	w := newVoteWithdrawalWalk(t)
	rec := w.takeBack(t, w.people["Liaison"])
	if rec.Code < 400 || rec.Code >= 500 {
		t.Fatalf("resident withdraws another member's vote: %d %s, want 4xx", rec.Code, rec.Body.String())
	}
	if votes := w.storedVotes(t, w.caseID); len(votes) != 1 {
		t.Fatalf("stored votes = %v, want the vote to stay", votes)
	}
}

func TestTakeBackVote_AnAgentCannotWithdrawAMembersVote(t *testing.T) {
	w := newVoteWithdrawalWalk(t)
	rec := w.takeBack(t, w.agent)
	if rec.Code < 400 || rec.Code >= 500 {
		t.Fatalf("agent withdraws a member's vote: %d %s, want 4xx", rec.Code, rec.Body.String())
	}
	if votes := w.storedVotes(t, w.caseID); len(votes) != 1 {
		t.Fatalf("stored votes = %v, want the vote to stay", votes)
	}
}

func TestTakeBackVote_AMemberCanTakeBackTheirOwnVote(t *testing.T) {
	w := newVoteWithdrawalWalk(t)
	rec := w.takeBack(t, w.people["Volunteer"])
	if rec.Code != http.StatusOK {
		t.Fatalf("member takes back their own vote: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if votes := w.storedVotes(t, w.caseID); len(votes) != 0 {
		t.Fatalf("stored votes = %v, want none", votes)
	}
}

func TestTakeBackVote_TheOwnerCanWithdrawAMembersVote(t *testing.T) {
	w := newVoteWithdrawalWalk(t)
	rec := w.takeBack(t, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner withdraws a member's vote: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if votes := w.storedVotes(t, w.caseID); len(votes) != 0 {
		t.Fatalf("stored votes = %v, want none", votes)
	}
}

func TestTakeBackVote_TheToolNamesTheMemberTheGateReads(t *testing.T) {
	found := false
	for _, tool := range taskmanagerroutes.ToolShape() {
		if tool.Name != takeBackVoteTool {
			continue
		}
		found = true
		var schema struct {
			Properties map[string]json.RawMessage `json:"properties"`
		}
		if err := json.Unmarshal(tool.InputSchema, &schema); err != nil {
			t.Fatalf("schema: %v", err)
		}
		if _, ok := schema.Properties[voteMemberArg]; !ok {
			t.Fatalf("%s has no %s property: %v", takeBackVoteTool, voteMemberArg, schema.Properties)
		}
	}
	if !found {
		t.Fatalf("%s is not a tool", takeBackVoteTool)
	}
}

func TestTakeBackVote_TheToolRefusesAnotherMembersVoteUnlessTheCallerIsOwner(t *testing.T) {
	args := map[string]json.RawMessage{voteMemberArg: json.RawMessage(`"neighbour"`)}
	if refuseVoteWithdrawal("someone-else", agencies.RoleResident, args) == nil {
		t.Fatalf("a resident withdrawing another member's vote was admitted")
	}
	if refuseVoteWithdrawal("agent-clerk", agencies.RoleAgent, args) == nil {
		t.Fatalf("an agent withdrawing a member's vote was admitted")
	}
	if refuseVoteWithdrawal("neighbour", agencies.RoleResident, args) != nil {
		t.Fatalf("a member taking back their own vote was refused")
	}
	if refuseVoteWithdrawal("test-owner", agencies.RoleOwner, args) != nil {
		t.Fatalf("the owner withdrawing a member's vote was refused")
	}
	if refuseVoteWithdrawal("", agencies.RoleResident, map[string]json.RawMessage{}) == nil {
		t.Fatalf("an unnamed member with no caller was admitted")
	}
}
