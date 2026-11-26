package http

import (
	"context"
	"errors"
	"testing"

	mwanachamataskmanager "github.com/aosanya/mwanachama-backend-taskmanager"

	"wakalaserver/internal/agencies"
)

func questionBoard(t *testing.T, w stepRunWalk) mwanachamataskmanager.TaskManager {
	t.Helper()
	var reg agencies.Registry
	reg, err := agencies.NewRegistry(w.db, agencies.WithQuestionRoleHolders(QuestionRoleHolders(func() agencies.Registry { return reg })))
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	board, err := reg.TaskManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("TaskManager: %v", err)
	}
	return board
}

func askTheCoordinator(t *testing.T, w stepRunWalk, board mwanachamataskmanager.TaskManager) mwanachamataskmanager.RuleRecord {
	t.Helper()
	question, err := board.CreateRule(context.Background(), w.subjects["Volunteer"], mwanachamataskmanager.RuleRecord{
		Kind:       "question",
		Title:      "Which clinic takes the referral?",
		TargetRole: w.roles["Coordinator"],
		Options:    []mwanachamataskmanager.QuestionOption{{Text: "North", Recommended: true, Reason: "Nearest"}, {Text: "South"}},
	})
	if err != nil {
		t.Fatalf("CreateRule: %v", err)
	}
	return question
}

func firstOption() mwanachamataskmanager.QuestionAnswer {
	first := 0
	return mwanachamataskmanager.QuestionAnswer{Option: &first}
}

func TestTheHolderOfTheTargetRoleAnswersAQuestionByAnOption(t *testing.T) {
	w := referral(t)
	board := questionBoard(t, w)
	question := askTheCoordinator(t, w, board)

	answered, err := board.AnswerQuestionWith(context.Background(), w.subjects["Coordinator"], question.Code, firstOption())
	if err != nil {
		t.Fatalf("answer by option: %v", err)
	}
	if answered.Status != "answered" || answered.Answer != "North" {
		t.Fatalf("answered = %q %q, want answered North", answered.Status, answered.Answer)
	}
}

func TestTheHolderOfTheTargetRoleAnswersAQuestionInTheirOwnWords(t *testing.T) {
	w := referral(t)
	board := questionBoard(t, w)
	question := askTheCoordinator(t, w, board)

	answered, err := board.AnswerQuestionWith(context.Background(), w.subjects["Coordinator"], question.Code, mwanachamataskmanager.QuestionAnswer{Other: "East, it opens early"})
	if err != nil {
		t.Fatalf("answer by other: %v", err)
	}
	if answered.Answer != "East, it opens early" {
		t.Fatalf("answer = %q", answered.Answer)
	}
}

func TestSomeoneWithoutTheTargetRoleIsRefusedOnEveryWayOfAnswering(t *testing.T) {
	w := referral(t)
	board := questionBoard(t, w)
	ctx := context.Background()
	decision, err := board.CreateRule(ctx, w.subjects["Coordinator"], mwanachamataskmanager.RuleRecord{Kind: "decision", Title: "North takes referrals"})
	if err != nil {
		t.Fatalf("CreateRule decision: %v", err)
	}
	ways := map[string]mwanachamataskmanager.QuestionAnswer{
		"option":   firstOption(),
		"other":    {Other: "East"},
		"decision": {DecisionCode: decision.Code},
	}
	for name, way := range ways {
		question := askTheCoordinator(t, w, board)
		_, err := board.AnswerQuestionWith(ctx, w.subjects["Volunteer"], question.Code, way)
		if !errors.Is(err, mwanachamataskmanager.ErrBacklogForbidden) {
			t.Fatalf("a volunteer answering by %s = %v, want ErrBacklogForbidden", name, err)
		}
	}
}

func TestTheInstanceOwnerWithoutTheRoleIsRefusedLikeAnyoneElse(t *testing.T) {
	w := referral(t)
	board := questionBoard(t, w)
	question := askTheCoordinator(t, w, board)

	_, err := board.AnswerQuestionWith(context.Background(), "test-owner", question.Code, firstOption())
	if !errors.Is(err, mwanachamataskmanager.ErrBacklogForbidden) {
		t.Fatalf("the owner without the role answering = %v, want ErrBacklogForbidden", err)
	}
}

func TestAnAgencyWithNoPublishedVersionRefusesEveryAnswer(t *testing.T) {
	w := newStepRunWalk(t, nil)
	board := questionBoard(t, w)
	question, err := board.CreateRule(context.Background(), "test-owner", mwanachamataskmanager.RuleRecord{Kind: "question", Title: "Who decides?", TargetRole: "Coordinator"})
	if err != nil {
		t.Fatalf("CreateRule: %v", err)
	}
	_, err = board.AnswerQuestionWith(context.Background(), "test-owner", question.Code, mwanachamataskmanager.QuestionAnswer{Other: "Me"})
	if !errors.Is(err, mwanachamataskmanager.ErrBacklogForbidden) {
		t.Fatalf("answering with no published roles = %v, want ErrBacklogForbidden", err)
	}
}
