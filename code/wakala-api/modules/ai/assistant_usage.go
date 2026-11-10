package ai

import (
	"context"
	"fmt"

	"wakalaserver/modules/ai/models"
)

type AssistantUsage = models.AssistantUsage

const (
	reachedNothing = ""
	reachedDay     = "day"
	reachedMonth   = "month"
)

func (m *accountManager) MyAssistantUsage(ctx context.Context, agencyID, personID string) (AssistantUsage, error) {
	if personID == "" {
		return AssistantUsage{}, fmt.Errorf("%w: the call has no person to count", ErrInvalidAccount)
	}
	limits, err := m.GetAssistantLimits(ctx, agencyID)
	if err != nil {
		return AssistantUsage{}, err
	}
	today := m.instant().Format(models.UsageDayLayout)
	firstOfMonth := m.instant().Format("2006-01") + "-01"
	day, err := m.personTokens(ctx, agencyID, personID, today, today)
	if err != nil {
		return AssistantUsage{}, err
	}
	month, err := m.personTokens(ctx, agencyID, personID, firstOfMonth, today)
	if err != nil {
		return AssistantUsage{}, err
	}
	return AssistantUsage{
		DayTokens:   day,
		MonthTokens: month,
		DayLimit:    limits.TokensPerPersonDay,
		MonthLimit:  limits.TokensPerPersonMonth,
		Reached:     reachedFor(day, month, limits),
	}, nil
}

func reachedFor(day, month int, limits AssistantLimits) string {
	switch {
	case limits.TokensPerPersonDay > 0 && day >= limits.TokensPerPersonDay:
		return reachedDay
	case limits.TokensPerPersonMonth > 0 && month >= limits.TokensPerPersonMonth:
		return reachedMonth
	}
	return reachedNothing
}
