package ai

import (
	"context"

	"wakalaserver/modules/ai/models"
)

type shareWindow struct {
	today        string
	firstOfMonth string
}

func (m *accountManager) shareWindow() shareWindow {
	now := m.instant()
	return shareWindow{today: now.Format(models.UsageDayLayout), firstOfMonth: now.Format("2006-01") + "-01"}
}

func (m *accountManager) shareLimitsFor(ctx context.Context, limits AssistantLimits, personID string) (day, month int, err error) {
	owner := false
	if m.isOwner != nil {
		if owner, err = m.isOwner(ctx, personID); err != nil {
			return 0, 0, err
		}
	}
	if owner {
		return limits.OwnerTokensPerPersonDay, limits.OwnerTokensPerPersonMonth, nil
	}
	return limits.TokensPerPersonDay, limits.TokensPerPersonMonth, nil
}

func (m *accountManager) personShareUsed(ctx context.Context, agencyID, personID string) (day, month int, err error) {
	w := m.shareWindow()
	if day, err = m.personTokens(ctx, agencyID, personID, w.today, w.today); err != nil {
		return 0, 0, err
	}
	if month, err = m.personTokens(ctx, agencyID, personID, w.firstOfMonth, w.today); err != nil {
		return 0, 0, err
	}
	return day, month, nil
}
