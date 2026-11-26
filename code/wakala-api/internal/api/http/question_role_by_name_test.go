package http

import (
	"context"
	"errors"
	"net/http"
	"testing"

	mwanachamataskmanager "github.com/aosanya/mwanachama-backend-taskmanager"
)

func askTheCoordinatorByName(t *testing.T, w stepRunWalk, board mwanachamataskmanager.TaskManager) mwanachamataskmanager.RuleRecord {
	t.Helper()
	question, err := board.CreateRule(context.Background(), w.subjects["Volunteer"], mwanachamataskmanager.RuleRecord{
		Kind:       "question",
		Title:      "Which clinic takes the referral?",
		TargetRole: "Coordinator",
		Options:    []mwanachamataskmanager.QuestionOption{{Text: "North", Recommended: true, Reason: "Nearest"}, {Text: "South"}},
	})
	if err != nil {
		t.Fatalf("CreateRule: %v", err)
	}
	return question
}

func TestTheHolderOfARoleNamedAsTheTargetAnswersTheQuestion(t *testing.T) {
	w := referral(t)
	board := questionBoard(t, w)
	question := askTheCoordinatorByName(t, w, board)

	answered, err := board.AnswerQuestionWith(context.Background(), w.subjects["Coordinator"], question.Code, firstOption())
	if err != nil {
		t.Fatalf("the Coordinator answering a question for the role named Coordinator: %v", err)
	}
	if answered.Status != "answered" {
		t.Fatalf("status = %q, want answered", answered.Status)
	}
}

func TestTheRoleNameOnAQuestionDoesNotLetAnotherRoleAnswer(t *testing.T) {
	w := referral(t)
	board := questionBoard(t, w)
	question := askTheCoordinatorByName(t, w, board)

	_, err := board.AnswerQuestionWith(context.Background(), w.subjects["Volunteer"], question.Code, firstOption())
	if !errors.Is(err, mwanachamataskmanager.ErrBacklogForbidden) {
		t.Fatalf("a volunteer answering a question for the Coordinator = %v, want ErrBacklogForbidden", err)
	}
}

func TestMyRolesListsTheSeatedRolesOfEveryGroupBesideTheOnesOfTheGroupWorkedIn(t *testing.T) {
	w := referral(t)
	idle := w.cookieFor(t, w.subjects["Coordinator"])

	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-roles", nil, idle)
	if rec.Code != http.StatusOK {
		t.Fatalf("my-roles: %d %s", rec.Code, rec.Body.String())
	}
	body := decodeObject(t, rec)
	if roles, _ := body["roles"].([]any); len(roles) != 0 {
		t.Fatalf("roles with no group worked in = %v, want none", roles)
	}
	seated, _ := body["seated_roles"].([]any)
	if len(seated) != 1 || seated[0].(map[string]any)["name"] != "Coordinator" {
		t.Fatalf("seated_roles = %v, want [Coordinator]", body["seated_roles"])
	}
}
