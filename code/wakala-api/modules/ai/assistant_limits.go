package ai

import (
	"context"
	"fmt"

	"wakalaserver/modules/ai/models"
)

const roleAssistantLimits = "assistant_limits"

const (
	assistantDaySentence   = "you have used today's share of the assistant, it comes back tomorrow"
	assistantMonthSentence = "you have used this month's share of the assistant, it comes back on the 1st"
)

type AssistantLimits = models.AssistantLimits

var errNoAssistantLimits = fmt.Errorf("no assistant limits")

func (m *accountManager) GetAssistantLimits(ctx context.Context, agencyID string) (AssistantLimits, error) {
	var row AssistantLimits
	q := m.st.Query(ctx, roleAssistantLimits).Where("id = ?", agencyID)
	switch err := m.st.Take(q, roleAssistantLimits, &row, errNoAssistantLimits); err {
	case nil:
		return row, nil
	case errNoAssistantLimits:
		return AssistantLimits{ID: agencyID, AgencyID: agencyID}, nil
	default:
		return AssistantLimits{}, fmt.Errorf("GetAssistantLimits: %w", err)
	}
}

func (m *accountManager) SetAssistantLimits(ctx context.Context, agencyID string, in AssistantLimits) (AssistantLimits, error) {
	if in.TokensPerPersonDay < 0 || in.TokensPerPersonMonth < 0 {
		return AssistantLimits{}, fmt.Errorf("%w: an assistant limit cannot be negative", ErrInvalidAccount)
	}
	row := AssistantLimits{ID: agencyID, AgencyID: agencyID, TokensPerPersonDay: in.TokensPerPersonDay, TokensPerPersonMonth: in.TokensPerPersonMonth, UpdatedAt: m.now()}
	if err := m.st.Query(ctx, roleAssistantLimits).Where("id = ?", agencyID).Delete(&struct{}{}).Error; err != nil {
		return AssistantLimits{}, fmt.Errorf("SetAssistantLimits: %w", err)
	}
	if err := m.st.Insert(ctx, roleAssistantLimits, row); err != nil {
		return AssistantLimits{}, fmt.Errorf("SetAssistantLimits: %w", err)
	}
	return row, nil
}

func (m *accountManager) ChatAccountAs(ctx context.Context, agencyID, accountID, personID string, in ChatInput) (ChatReply, error) {
	if personID != "" {
		in.Person = personID
		if in.RoleID == "" {
			if err := m.checkPersonShare(ctx, agencyID, personID); err != nil {
				return ChatReply{}, err
			}
		}
	}
	return m.ChatAccount(ctx, agencyID, accountID, in)
}

func (m *accountManager) checkPersonShare(ctx context.Context, agencyID, personID string) error {
	limits, err := m.GetAssistantLimits(ctx, agencyID)
	if err != nil {
		return err
	}
	if limits.TokensPerPersonDay == 0 && limits.TokensPerPersonMonth == 0 {
		return nil
	}
	today := m.instant().Format(models.UsageDayLayout)
	if limits.TokensPerPersonDay > 0 {
		used, err := m.personTokens(ctx, agencyID, personID, today, today)
		if err != nil {
			return err
		}
		if used >= limits.TokensPerPersonDay {
			return fmt.Errorf("%w: day, %s", ErrAssistantLimit, assistantDaySentence)
		}
	}
	if limits.TokensPerPersonMonth > 0 {
		first := m.instant().Format("2006-01") + "-01"
		used, err := m.personTokens(ctx, agencyID, personID, first, today)
		if err != nil {
			return err
		}
		if used >= limits.TokensPerPersonMonth {
			return fmt.Errorf("%w: month, %s", ErrAssistantLimit, assistantMonthSentence)
		}
	}
	return nil
}

func (m *accountManager) personTokens(ctx context.Context, agencyID, personID, from, to string) (int, error) {
	var t tally
	err := m.st.Query(ctx, roleUsageDay).
		Where("agency_id = ? AND person = ? AND day >= ? AND day <= ?", agencyID, personID, from, to).
		Select("COALESCE(SUM(requests),0) AS requests, COALESCE(SUM(tokens_in + tokens_out),0) AS tokens").
		Scan(&t).Error
	return t.Tokens, err
}
