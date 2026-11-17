package routes_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"reflect"
	"testing"

	accounting "wakalaserver/modules/accounting"
	"wakalaserver/modules/accounting/routes"
)

type totalRow struct {
	Value   string `json:"value"`
	Total   int64  `json:"total"`
	Entries int    `json:"entries"`
}

type totalsBody struct {
	Key         string     `json:"key"`
	AccountType string     `json:"account_type"`
	PeriodStart string     `json:"period_start"`
	PeriodEnd   string     `json:"period_end"`
	Totals      []totalRow `json:"totals"`
}

type townLedger struct {
	repo   accounting.LedgerRepository
	wages  accounting.Account
	repair accounting.Account
	cash   accounting.Account
}

func (l townLedger) spend(t *testing.T, from accounting.Account, amount int64, occurredAt, area string) {
	t.Helper()
	e := accounting.Entry{
		DebitAccountID: from.ID, CreditAccountID: l.cash.ID, Amount: amount, OccurredAt: occurredAt,
		DocumentKind: "invoice", DocumentID: "doc", ActorID: "actor-1",
	}
	if area != "" {
		e.Dimensions = map[string]string{"neighbourhood": area}
	}
	if _, err := l.repo.Post(context.Background(), e); err != nil {
		t.Fatalf("post: %v", err)
	}
}

func zoldhalomLedger(t *testing.T) townLedger {
	t.Helper()
	repo := ledgerOnMemory(t)
	open := func(category accounting.AccountCategory, kind accounting.AccountType) accounting.Account {
		a, err := repo.OpenAccount(context.Background(), accounting.Account{Category: category, Type: kind, HolderID: "zoldhalom"})
		if err != nil {
			t.Fatalf("OpenAccount(%s): %v", category, err)
		}
		return a
	}
	l := townLedger{
		repo:   repo,
		wages:  open("wages", accounting.AccountTypeExpense),
		repair: open("repairs", accounting.AccountTypeExpense),
		cash:   open("cash", accounting.AccountTypeAsset),
	}
	l.spend(t, l.wages, 100, "2026-01-10T09:00:00Z", "Óváros")
	l.spend(t, l.repair, 50, "2026-01-20T09:00:00Z", "Óváros")
	l.spend(t, l.wages, 200, "2026-01-01T00:00:00Z", "Kertváros")
	l.spend(t, l.repair, 70, "2026-02-01T00:00:00Z", "Malomsor")
	l.spend(t, l.wages, 30, "2026-01-15T09:00:00Z", "Határrét")
	l.spend(t, l.wages, 999, "2026-01-12T09:00:00Z", "")
	return l
}

func totalsOver(t *testing.T, repo accounting.LedgerRepository, query url.Values) totalsBody {
	t.Helper()
	rec := serve(routes.Routes(repo), http.MethodGet, "/dimension-totals?"+query.Encode(), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("dimension totals: got %d, want 200, body %s", rec.Code, rec.Body.String())
	}
	var out totalsBody
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode totals: %v", err)
	}
	return out
}

func TestDimensionTotalsOverTheWireGivesTheSpendPerNeighbourhood(t *testing.T) {
	l := zoldhalomLedger(t)

	got := totalsOver(t, l.repo, url.Values{"key": {"neighbourhood"}, "account_type": {"expense"}})

	want := []totalRow{
		{Value: "Határrét", Total: 30, Entries: 1},
		{Value: "Kertváros", Total: 200, Entries: 1},
		{Value: "Malomsor", Total: 70, Entries: 1},
		{Value: "Óváros", Total: 150, Entries: 2},
	}
	if got.Key != "neighbourhood" || got.AccountType != "expense" {
		t.Fatalf("totals = %+v, want the key and account type echoed", got)
	}
	if !reflect.DeepEqual(got.Totals, want) {
		t.Fatalf("totals = %+v, want %+v", got.Totals, want)
	}
}

func TestDimensionTotalsOverTheWireNarrowsToThePeriod(t *testing.T) {
	l := zoldhalomLedger(t)

	got := totalsOver(t, l.repo, url.Values{
		"key": {"neighbourhood"}, "account_type": {"expense"},
		"period_start": {"2026-01-01T00:00:00Z"}, "period_end": {"2026-02-01T00:00:00Z"},
	})

	want := []totalRow{
		{Value: "Határrét", Total: 30, Entries: 1},
		{Value: "Kertváros", Total: 200, Entries: 1},
		{Value: "Óváros", Total: 150, Entries: 2},
	}
	if got.PeriodStart != "2026-01-01T00:00:00Z" || got.PeriodEnd != "2026-02-01T00:00:00Z" {
		t.Fatalf("totals = %+v, want the period echoed", got)
	}
	if !reflect.DeepEqual(got.Totals, want) {
		t.Fatalf("totals = %+v, want %+v", got.Totals, want)
	}
}

func TestDimensionTotalsOverTheWireRefusesABadQueryWith400(t *testing.T) {
	l := zoldhalomLedger(t)

	for name, query := range map[string]url.Values{
		"missing key":          {"account_type": {"expense"}},
		"unknown account type": {"key": {"neighbourhood"}, "account_type": {"bogus"}},
		"only a period start":  {"key": {"neighbourhood"}, "period_start": {"2026-01-01T00:00:00Z"}},
		"inverted period":      {"key": {"neighbourhood"}, "period_start": {"2026-02-01T00:00:00Z"}, "period_end": {"2026-01-01T00:00:00Z"}},
	} {
		rec := serve(routes.Routes(l.repo), http.MethodGet, "/dimension-totals?"+query.Encode(), "")
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s: got %d, want 400, body %s", name, rec.Code, rec.Body.String())
		}
	}
}

func TestTheDimensionTotalsToolGivesOneTotalPerNeighbourhood(t *testing.T) {
	l := zoldhalomLedger(t)
	tool, ok := budgetTools(t, l.repo)["accounting_dimension_totals"]
	if !ok {
		t.Fatal("accounting_dimension_totals is not served")
	}
	if tool.Action != "accounting.dimension.totals" {
		t.Fatalf("action = %q, want accounting.dimension.totals", tool.Action)
	}

	out, err := tool.Invoke(context.Background(), json.RawMessage(`{"key":"neighbourhood","account_type":"expense"}`))
	if err != nil {
		t.Fatalf("invoke: %v", err)
	}
	got := out.(accounting.DimensionTotals)

	want := []accounting.DimensionTotal{
		{Value: "Határrét", Total: 30, Entries: 1},
		{Value: "Kertváros", Total: 200, Entries: 1},
		{Value: "Malomsor", Total: 70, Entries: 1},
		{Value: "Óváros", Total: 150, Entries: 2},
	}
	if !reflect.DeepEqual(got.Totals, want) {
		t.Fatalf("totals = %+v, want %+v", got.Totals, want)
	}
}
