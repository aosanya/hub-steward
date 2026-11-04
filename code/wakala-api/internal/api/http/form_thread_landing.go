package http

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	mwanachamacomm "wakalaserver/modules/comm"
	commmodels "wakalaserver/modules/comm/models"
	forms "wakalaserver/modules/forms"
	formsmodels "wakalaserver/modules/forms/models"

	"wakalaserver/internal/accounts"
)

var (
	errSendNamedNoGroup = errors.New("the send was filed under no group")
	errNobodySent       = errors.New("no caller sent the answers")

	errThreadIsAnotherSenders = errors.New("the thread titled with the form was requested by someone else")
)

type sendsLandedInThreads struct {
	forms.FormManager
	rooms      commRooms
	instanceID string
}

func (s sendsLandedInThreads) SubmitAnswersFor(ctx context.Context, formID, memberID, answeringAs, language, periodKey string, in []formsmodels.Answer) ([]formsmodels.Answer, error) {
	stored, err := s.FormManager.SubmitAnswersFor(ctx, formID, memberID, answeringAs, language, periodKey, in)
	if err != nil {
		return stored, err
	}
	if err := s.landInThread(ctx, formID, stored); err != nil {
		slog.Default().Warn("a standing form's send opened no thread",
			"instance", s.instanceID, "form", formID, "error", err.Error())
	}
	return stored, nil
}

func (s sendsLandedInThreads) landInThread(ctx context.Context, formID string, stored []formsmodels.Answer) error {
	form, err := s.FormManager.Get(ctx, formID)
	if err != nil {
		return err
	}
	if !landsInAThread(form) {
		return nil
	}
	body, err := s.sentLines(ctx, form, stored)
	if err != nil || body == "" {
		return err
	}
	return s.postToSendersThread(ctx, form.Title, answeredThrough(stored), body)
}

func landsInAThread(f formsmodels.Form) bool {
	return f.Standing && f.Landing == forms.LandingThread
}

func (s sendsLandedInThreads) sentLines(ctx context.Context, form formsmodels.Form, stored []formsmodels.Answer) (string, error) {
	questions, err := s.FormManager.ListQuestions(ctx, form.ID)
	if err != nil {
		return "", err
	}
	labels, err := s.optionLabels(ctx, questions)
	if err != nil {
		return "", err
	}
	return answerLines(questions, labels, stored), nil
}

func (s sendsLandedInThreads) optionLabels(ctx context.Context, questions []formsmodels.Question) (map[string]string, error) {
	labels := map[string]string{}
	for _, q := range questions {
		if !q.AnswerType.HasOptions() {
			continue
		}
		options, err := s.FormManager.ListOptions(ctx, q.ID)
		if err != nil {
			return nil, err
		}
		for _, o := range options {
			labels[o.ID] = o.Label
		}
	}
	return labels, nil
}

func (s sendsLandedInThreads) postToSendersThread(ctx context.Context, title, groupID, body string) error {
	sender := accounts.IDFromContext(ctx)
	if sender == "" {
		return errNobodySent
	}
	if groupID == "" {
		return errSendNamedNoGroup
	}
	cm, err := s.rooms.CommManager(ctx, s.instanceID)
	if err != nil {
		return err
	}
	thread, err := sendersThread(ctx, cm, groupID, sender, title)
	if err != nil {
		return err
	}
	_, err = cm.PostChatMessageFor(ctx, groupID, thread.ID, sender, body, "", "")
	return err
}

func sendersThread(ctx context.Context, cm *mwanachamacomm.CommManager, groupID, sender, title string) (commmodels.ChatThread, error) {
	held, err := cm.ChatStore.ListThreads(ctx, groupID)
	if err != nil {
		return commmodels.ChatThread{}, err
	}
	if own, found := threadRequestedBy(held, sender, title); found {
		return own, nil
	}
	started, err := cm.StartChatThreadFor(ctx, groupID, sender, title)
	if err != nil {
		return commmodels.ChatThread{}, err
	}
	if started.RequestedBy != "" && started.RequestedBy != sender {
		return commmodels.ChatThread{}, errThreadIsAnotherSenders
	}
	return started, nil
}

func threadRequestedBy(threads []commmodels.ChatThread, sender, title string) (commmodels.ChatThread, bool) {
	label := strings.Join(strings.Fields(title), " ")
	for i := len(threads) - 1; i >= 0; i-- {
		t := threads[i]
		if t.RequestedBy == sender && t.Label == label && !t.Declined() {
			return t, true
		}
	}
	return commmodels.ChatThread{}, false
}
