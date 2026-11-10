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
	dayLimit, monthLimit, err := m.shareLimitsFor(ctx, limits, personID)
	if err != nil {
		return AssistantUsage{}, err
	}
	day, month, err := m.personShareUsed(ctx, agencyID, personID)
	if err != nil {
		return AssistantUsage{}, err
	}
	return AssistantUsage{
		DayTokens:   day,
		MonthTokens: month,
		DayLimit:    dayLimit,
		MonthLimit:  monthLimit,
		Reached:     reachedFor(day, month, dayLimit, monthLimit),
	}, nil
}

func reachedFor(day, month, dayLimit, monthLimit int) string {
	switch {
	case dayLimit > 0 && day >= dayLimit:
		return reachedDay
	case monthLimit > 0 && month >= monthLimit:
		return reachedMonth
	}
	return reachedNothing
}
