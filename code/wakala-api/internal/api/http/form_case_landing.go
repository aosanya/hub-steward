package http

import (
	"context"
	"log/slog"
	"strings"

	forms "wakalaserver/modules/forms"
	formsmodels "wakalaserver/modules/forms/models"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

const (
	caseSubjectFormSend = "form_send"
	caseTitleLimit      = 120
)

type caseBoards interface {
	TaskManager(ctx context.Context, id string) (mwanachamataskmanager.TaskManager, error)
}

type formLandingRooms interface {
	commRooms
	caseBoards
}

func sendsLanded(fm forms.FormManager, reg formLandingRooms, instanceID string) forms.FormManager {
	threads := sendsLandedInThreads{FormManager: fm, rooms: reg, instanceID: instanceID}
	return sendsLandedInCases{FormManager: threads, boards: reg, instanceID: instanceID}
}

type sendsLandedInCases struct {
	forms.FormManager
	boards     caseBoards
	instanceID string
}

func (s sendsLandedInCases) SubmitAnswersFor(ctx context.Context, formID, memberID, answeringAs, language, periodKey string, in []formsmodels.Answer) ([]formsmodels.Answer, error) {
	stored, err := s.FormManager.SubmitAnswersFor(ctx, formID, memberID, answeringAs, language, periodKey, in)
	if err != nil {
		return stored, err
	}
	if err := s.landInCase(ctx, formID, memberID, stored); err != nil {
		slog.Default().Warn("a standing form's send opened no case",
			"instance", s.instanceID, "form", formID, "error", err.Error())
	}
	return stored, nil
}

func (s sendsLandedInCases) landInCase(ctx context.Context, formID, memberID string, stored []formsmodels.Answer) error {
	if len(stored) == 0 {
		return nil
	}
	form, err := s.FormManager.Get(ctx, formID)
	if err != nil {
		return err
	}
	if !landsInACase(form) {
		return nil
	}
	questions, err := s.FormManager.ListQuestions(ctx, formID)
	if err != nil {
		return err
	}
	board, err := s.boards.TaskManager(ctx, s.instanceID)
	if err != nil {
		return err
	}
	_, err = board.OpenCase(ctx, memberID, mwanachamataskmanager.Case{
		Title:       caseTitle(form.Title, questions, stored),
		SubjectKind: caseSubjectFormSend,
		SubjectID:   stored[0].SendID,
	})
	return err
}

func landsInACase(f formsmodels.Form) bool {
	return f.Standing && f.Landing == forms.LandingCase
}

func caseTitle(formTitle string, questions []formsmodels.Question, stored []formsmodels.Answer) string {
	given := make(map[string]string, len(stored))
	for _, a := range stored {
		given[a.QuestionID] = a.ValueText
	}
	for _, q := range questions {
		line, _, _ := strings.Cut(strings.TrimSpace(given[q.ID]), "\n")
		if title := strings.Join(strings.Fields(line), " "); title != "" {
			return firstRunes(title, caseTitleLimit)
		}
	}
	return formTitle
}

func firstRunes(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n])
}
