package mwanachamaforms

import (
	"context"

	"wakalaserver/modules/forms/models"
)

func (m *formManager) ShowMySubmission(ctx context.Context, formID, memberID string) (models.Submission, error) {
	held, err := m.GetSubmission(ctx, formID, memberID)
	held.PaidBy = ""
	return held, err
}
