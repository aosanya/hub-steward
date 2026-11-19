package agencies

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	mwanachamaaccounting "github.com/aosanya/mwanachama-backend-accounting"
	accountingmodels "github.com/aosanya/mwanachama-backend-accounting/models"
	actormodels "github.com/aosanya/mwanachama-backend-actor/models"
	mwanachamacatalog "github.com/aosanya/mwanachama-backend-catalog"
	catalogmodels "github.com/aosanya/mwanachama-backend-catalog/models"
	commmodels "github.com/aosanya/mwanachama-backend-comm/models"
)

const (
	lateRuleKeyPrefix = "late_rule."
	lateBillsLimit    = 500
)

type lateRule struct {
	Days int64  `json:"days"`
	Role string `json:"role"`
}

type lateBillSources struct {
	bills interface {
		ListBills(ctx context.Context, filter mwanachamaaccounting.BillFilter) ([]accountingmodels.Bill, error)
	}
	rules interface {
		GetSetting(ctx context.Context, key string) (catalogmodels.Setting, error)
	}
	holders interface {
		ListRoleHolders(ctx context.Context, kindID string, activeOnly bool) ([]actormodels.RoleHolder, error)
	}
	raiser interface {
		RaiseNotificationFor(ctx context.Context, callerID, recipientID string, category commmodels.NotificationCategory, event commmodels.NotificationEvent, subjectKind commmodels.NotificationSubjectKind, subjectID string, names map[string]string) (commmodels.Notification, error)
	}
}

func remindLateBills(ctx context.Context, src lateBillSources, now time.Time) (int, error) {
	bills, err := src.bills.ListBills(ctx, mwanachamaaccounting.BillFilter{
		Status: string(accountingmodels.BillOverdue),
		AsOf:   now.UTC().Format(time.RFC3339),
		Limit:  lateBillsLimit,
	})
	if err != nil {
		return 0, err
	}
	rules := map[string]*lateRule{}
	made := 0
	var firstErr error
	for _, bill := range bills {
		rule, ok := rules[bill.IncomeAccountID]
		if !ok {
			rule, err = readLateRule(ctx, src, bill.IncomeAccountID)
			if err != nil && firstErr == nil {
				firstErr = err
			}
			rules[bill.IncomeAccountID] = rule
		}
		if rule == nil || bill.DaysOverdue <= rule.Days {
			continue
		}
		sent, err := remindRoleOfBill(ctx, src, *rule, bill)
		made += sent
		if err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return made, firstErr
}

func readLateRule(ctx context.Context, src lateBillSources, incomeAccountID string) (*lateRule, error) {
	setting, err := src.rules.GetSetting(ctx, lateRuleKeyPrefix+incomeAccountID)
	if errors.Is(err, mwanachamacatalog.ErrSettingNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var rule lateRule
	if err := json.Unmarshal([]byte(setting.Value), &rule); err != nil || rule.Role == "" || rule.Days < 0 {
		return nil, nil
	}
	return &rule, nil
}

func remindRoleOfBill(ctx context.Context, src lateBillSources, rule lateRule, bill accountingmodels.Bill) (int, error) {
	holders, err := src.holders.ListRoleHolders(ctx, rule.Role, true)
	if err != nil {
		return 0, err
	}
	names := map[string]string{"payer": bill.Payer, "days_late": strconv.FormatInt(bill.DaysOverdue, 10)}
	sent := 0
	var firstErr error
	for _, holder := range holders {
		_, err := src.raiser.RaiseNotificationFor(ctx, "", holder.ActorID, commmodels.CategoryTask, commmodels.EventPaymentLate, commmodels.SubjectRecord, bill.ID, names)
		switch {
		case err == nil:
			sent++
		case errors.Is(err, commmodels.ErrNotificationCapSpent), errors.Is(err, commmodels.ErrNotificationMuted):
		case firstErr == nil:
			firstErr = err
		}
	}
	return sent, firstErr
}

func sweepLateBills(ctx context.Context, reg Registry, instanceID string, now time.Time) (int, error) {
	ledger, err := reg.LedgerRepository(ctx, instanceID)
	if err != nil {
		return 0, err
	}
	rules, err := reg.CatalogManager(ctx, instanceID, MountCatalog)
	if err != nil {
		return 0, err
	}
	people, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return 0, err
	}
	rooms, err := reg.CommManager(ctx, instanceID)
	if err != nil {
		return 0, err
	}
	return remindLateBills(ctx, lateBillSources{bills: ledger, rules: rules, holders: people, raiser: rooms}, now)
}
