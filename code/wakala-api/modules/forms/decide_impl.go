package mwanachamaforms

import (
	"context"
	"fmt"
	"strings"

	"wakalaserver/modules/forms/models"
)

func (m *formManager) DecideSubmission(ctx context.Context, formID, memberID string, decision models.Decision, note, decidedBy string) (models.Submission, error) {
	note = strings.TrimSpace(note)
	if decidedBy == "" || (decision != models.DecisionApproved && decision != models.DecisionRefused) {
		return models.Submission{}, ErrInvalidDecision
	}
	if decision == models.DecisionRefused && note == "" {
		return models.Submission{}, ErrMissingNote
	}
	if decidedBy == memberID {
		return models.Submission{}, ErrSelfDecision
	}
	held, err := m.GetSubmission(ctx, formID, memberID)
	if err != nil {
		return models.Submission{}, fmt.Errorf("DecideSubmission: %w", err)
	}
	held.Decision, held.DecidedBy, held.DecidedAt, held.DecisionNote = decision, decidedBy, models.NowRFC3339(), note
	if err := m.replace(ctx, roleSubmission, held.ID, held); err != nil {
		return models.Submission{}, fmt.Errorf("DecideSubmission: %w", err)
	}
	return held, nil
}
