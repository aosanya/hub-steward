package agencies

import (
	"context"
	"testing"
	"time"

	mwanachamaaccounting "github.com/aosanya/mwanachama-backend-accounting"
	accountingmodels "github.com/aosanya/mwanachama-backend-accounting/models"
	actormodels "wakalaserver/modules/actor/models"
	mwanachamacatalog "wakalaserver/modules/catalog"
	catalogmodels "wakalaserver/modules/catalog/models"
	commmodels "wakalaserver/modules/comm/models"
)

type lateLedger struct{ bills []accountingmodels.Bill }

func (l lateLedger) ListBills(context.Context, mwanachamaaccounting.BillFilter) ([]accountingmodels.Bill, error) {
	return l.bills, nil
}

type lateRules map[string]string

func (r lateRules) GetSetting(_ context.Context, key string) (catalogmodels.Setting, error) {
	value, ok := r[key]
	if !ok {
		return catalogmodels.Setting{}, mwanachamacatalog.ErrSettingNotFound
	}
	return catalogmodels.Setting{Key: key, Value: value}, nil
}

type lateHolders map[string][]string

func (h lateHolders) ListRoleHolders(_ context.Context, kind string, _ bool) ([]actormodels.RoleHolder, error) {
	var out []actormodels.RoleHolder
	for _, actorID := range h[kind] {
		out = append(out, actormodels.RoleHolder{ActorRoleAssignment: actormodels.ActorRoleAssignment{ActorID: actorID, KindID: kind, Active: true}})
	}
	return out, nil
}

type lateRaised struct {
	recipient string
	event     commmodels.NotificationEvent
	subjectID string
	names     map[string]string
}

type lateRaiser struct {
	raised []lateRaised
	seen   map[string]bool
}

func (r *lateRaiser) RaiseNotificationFor(_ context.Context, _, recipientID string, _ commmodels.NotificationCategory, event commmodels.NotificationEvent, _ commmodels.NotificationSubjectKind, subjectID string, names map[string]string) (commmodels.Notification, error) {
	key := recipientID + "|" + subjectID
	if r.seen == nil {
		r.seen = map[string]bool{}
	}
	if r.seen[key] {
		return commmodels.Notification{}, commmodels.ErrNotificationCapSpent
	}
	r.seen[key] = true
	r.raised = append(r.raised, lateRaised{recipient: recipientID, event: event, subjectID: subjectID, names: names})
	return commmodels.Notification{ActorID: recipientID, Event: event, SubjectID: subjectID}, nil
}

const (
	stallFees   = "income-stall-fees"
	localRates  = "income-local-rates"
	noRuleFees  = "income-hall-hire"
	financeRole = "role-finance-officer"
	mayorRole   = "role-mayor"
)

func lateBill(id, income string, daysOverdue int64) accountingmodels.Bill {
	return accountingmodels.Bill{ID: id, IncomeAccountID: income, Payer: "Szabó Pékség", Outstanding: 12000, Status: accountingmodels.BillOverdue, DaysOverdue: daysOverdue}
}

func lateSources(raiser *lateRaiser) lateBillSources {
	return lateBillSources{
		bills: lateLedger{bills: []accountingmodels.Bill{
			lateBill("bill-stall", stallFees, 15),
			lateBill("bill-rates", localRates, 15),
			lateBill("bill-hall", noRuleFees, 40),
			lateBill("bill-stall-inside", stallFees, 14),
		}},
		rules: lateRules{
			lateRuleKeyPrefix + stallFees:  `{"days":14,"role":"` + financeRole + `"}`,
			lateRuleKeyPrefix + localRates: `{"days":60,"role":"` + mayorRole + `"}`,
		},
		holders: lateHolders{financeRole: {"actor-finance-1", "actor-finance-2"}, mayorRole: {"actor-mayor"}},
		raiser:  raiser,
	}
}

func TestLateBillsRemindTheRoleOfTheChargeOnceWhenTheDaysPass(t *testing.T) {
	raiser := &lateRaiser{}
	now := time.Date(2026, 11, 18, 9, 0, 0, 0, time.UTC)
	made, err := remindLateBills(context.Background(), lateSources(raiser), now)
	if err != nil {
		t.Fatal(err)
	}
	if made != 2 || len(raiser.raised) != 2 {
		t.Fatalf("a stall fee 15 days past due with a 14 day rule reminds each finance officer once, got %d: %+v", made, raiser.raised)
	}
	for _, got := range raiser.raised {
		if got.subjectID != "bill-stall" || got.event != commmodels.EventPaymentLate {
			t.Fatalf("only the late stall fee is reminded, got %+v", got)
		}
		if got.recipient != "actor-finance-1" && got.recipient != "actor-finance-2" {
			t.Fatalf("the reminder goes to the role in the rule, got %q", got.recipient)
		}
	}
}

func TestLateBillsInsideTheirDaysOrWithoutARuleRemindNobody(t *testing.T) {
	raiser := &lateRaiser{}
	made, err := remindLateBills(context.Background(), lateSources(raiser), time.Date(2026, 11, 18, 9, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	for _, got := range raiser.raised {
		if got.subjectID == "bill-rates" || got.subjectID == "bill-hall" || got.subjectID == "bill-stall-inside" {
			t.Fatalf("bill %s must not remind anybody (rates inside 60 days, hall hire has no rule, stall at exactly 14 days), made %d", got.subjectID, made)
		}
	}
}

func TestLateBillsSweepRunTwiceRemindsOnce(t *testing.T) {
	raiser := &lateRaiser{}
	now := time.Date(2026, 11, 18, 9, 0, 0, 0, time.UTC)
	if _, err := remindLateBills(context.Background(), lateSources(raiser), now); err != nil {
		t.Fatal(err)
	}
	again, err := remindLateBills(context.Background(), lateSources(raiser), now.Add(6*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if again != 0 || len(raiser.raised) != 2 {
		t.Fatalf("the second run notifies nobody again, made %d, total raised %d", again, len(raiser.raised))
	}
}

func TestLateBillsNameThePayerAndTheDaysInTheReminder(t *testing.T) {
	raiser := &lateRaiser{}
	if _, err := remindLateBills(context.Background(), lateSources(raiser), time.Date(2026, 11, 18, 9, 0, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}
	got := raiser.raised[0].names
	if got["payer"] != "Szabó Pékség" || got["days_late"] != "15" {
		t.Fatalf("the reminder carries the payer and the days late, got %v", got)
	}
}
