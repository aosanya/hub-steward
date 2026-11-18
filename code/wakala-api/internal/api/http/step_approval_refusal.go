package http

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"unicode"

	mwanachamaactor "wakalaserver/modules/actor"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/accounts"
)

type approvalAboveLimitError struct {
	amount, limit int
}

func (e approvalAboveLimitError) Error() string {
	return fmt.Sprintf("The amount %s Ft is above the limit of %s Ft written to your role. Another role must approve it.", groupedThousands(e.amount), groupedThousands(e.limit))
}

func groupedThousands(n int) string {
	digits := strconv.Itoa(n)
	var b strings.Builder
	for i, r := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			b.WriteByte(' ')
		}
		b.WriteRune(r)
	}
	return b.String()
}

func wholeAmount(text string) (int, bool) {
	digits := strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) || r == ',' {
			return -1
		}
		return r
	}, text)
	if digits == "" {
		return 0, false
	}
	for _, r := range digits {
		if r < '0' || r > '9' {
			return 0, false
		}
	}
	n, err := strconv.Atoi(digits)
	return n, err == nil
}

func overLimitStamp(limit int) map[string]string {
	return map[string]string{stampedOverLimitPrompt: "yes", stampedLimitPrompt: strconv.Itoa(limit)}
}

func (d *Deps) refuseAmountAboveLimit(ctx context.Context, instanceID string, questions []agencymodels.StepQuestion, answers map[string]string) (map[string]string, error) {
	var checked []agencymodels.StepQuestion
	for _, q := range questions {
		if q.ChecksApprovalLimit {
			checked = append(checked, q)
		}
	}
	if len(checked) == 0 {
		return nil, nil
	}
	limit, err := d.callerApprovalLimit(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	var stamp map[string]string
	for _, q := range checked {
		text, given := answers[q.Prompt]
		if !given {
			continue
		}
		amount, ok := wholeAmount(text)
		if !ok {
			return nil, badRowError("the answer to " + q.Prompt + " is a whole number of forints, not negative")
		}
		if limit.Amount == nil || amount <= *limit.Amount {
			continue
		}
		directory, err := d.Registry.ActorManager(ctx, instanceID)
		if err != nil {
			return nil, err
		}
		outcome, err := mwanachamaactor.ApprovalOutcomeFor(ctx, directory, accounts.IDFromContext(ctx), amount)
		if err != nil {
			return nil, err
		}
		if !outcome.Allowed {
			return nil, approvalAboveLimitError{amount: amount, limit: *limit.Amount}
		}
		stamp = overLimitStamp(outcome.Limit)
	}
	return stamp, nil
}
