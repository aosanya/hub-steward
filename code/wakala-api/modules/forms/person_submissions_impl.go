package mwanachamaforms

import (
	"context"
	"errors"
	"fmt"
	"sort"

	"wakalaserver/modules/forms/models"
)

func (m *formManager) ListSubmissionsOfPerson(ctx context.Context, memberID string) ([]models.Submission, error) {
	if memberID == "" {
		return nil, fmt.Errorf("ListSubmissionsOfPerson: a member id is required: %w", ErrInvalidAnswer)
	}
	sends, err := m.submissionsBy(ctx, memberID)
	if err != nil {
		return nil, fmt.Errorf("ListSubmissionsOfPerson: %w", err)
	}
	titles := map[string]string{}
	given := map[string][]models.Answer{}
	out := make([]models.Submission, 0, len(sends))
	for _, send := range sends {
		title, readable, err := m.titleOfForm(ctx, titles, send.FormID)
		if err != nil {
			return nil, fmt.Errorf("ListSubmissionsOfPerson: %w", err)
		}
		if !readable {
			continue
		}
		if _, loaded := given[send.FormID]; !loaded {
			if given[send.FormID], err = m.answersOfPerson(ctx, send.FormID, memberID); err != nil {
				return nil, fmt.Errorf("ListSubmissionsOfPerson: %w", err)
			}
		}
		send.Answers = answersCarriedBy(send, given[send.FormID])
		send.Paid = send.PaidAt != ""
		send.FormTitle = title
		out = append(out, send)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].SubmittedAt != out[j].SubmittedAt {
			return out[i].SubmittedAt > out[j].SubmittedAt
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func (m *formManager) answersOfPerson(ctx context.Context, formID, memberID string) ([]models.Answer, error) {
	return listOf[models.Answer](m, m.q(ctx, roleAnswer).Where("form_id = ? AND member_id = ? AND withdrawn_at = ''", formID, memberID), roleAnswer)
}

func answersCarriedBy(send models.Submission, answers []models.Answer) int {
	lastTouched := send.SubmittedAt
	if send.EditedAt > lastTouched {
		lastTouched = send.EditedAt
	}
	carried := 0
	for _, a := range answers {
		sameSlot := a.ChapterID == send.ChapterID && a.PeriodKey == send.PeriodKey && a.RepeatOf == send.RepeatOf
		if sameSlot && a.AnsweredAt <= lastTouched {
			carried++
		}
	}
	return carried
}

func (m *formManager) titleOfForm(ctx context.Context, known map[string]string, formID string) (string, bool, error) {
	if title, ok := known[formID]; ok {
		return title, true, nil
	}
	form, err := m.Get(ctx, formID)
	if errors.Is(err, ErrFormNotFound) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	known[formID] = form.Title
	return form.Title, true, nil
}
