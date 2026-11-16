package routes_test

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"testing"

	accounting "wakalaserver/modules/accounting"
	"wakalaserver/modules/accounting/routes"
)

func procurementTools(t *testing.T, repo accounting.LedgerRepository) map[string]routes.Tool {
	t.Helper()
	tools, err := routes.BuildTools(repo, routes.Mount{Caller: func(context.Context) string { return "clerk-3" }})
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]routes.Tool{}
	for _, tool := range tools {
		out[tool.Name] = tool
	}
	return out
}

func TestTheProcurementToolsAreServed(t *testing.T) {
	got := []string{}
	for name := range procurementTools(t, ledgerOnMemory(t)) {
		if strings.HasPrefix(name, "accounting_tender_") || strings.HasPrefix(name, "accounting_quote_") {
			got = append(got, name)
		}
	}
	sort.Strings(got)
	want := []string{"accounting_quote_create", "accounting_quote_list", "accounting_quote_update", "accounting_tender_create", "accounting_tender_list", "accounting_tender_read", "accounting_tender_update"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("served %v, want %v", got, want)
	}
}

func TestATenderAndItsQuotesGoThroughTheToolsWithTheCallerRecorded(t *testing.T) {
	repo := ledgerOnMemory(t)
	ctx := context.Background()
	roads, err := repo.OpenAccount(ctx, accounting.Account{Code: "5100", Category: "roads", HolderID: "town", Type: accounting.AccountTypeExpense})
	if err != nil {
		t.Fatal(err)
	}
	line, err := repo.SetBudget(ctx, accounting.Budget{AccountID: roads.ID, Name: "Road repair", PeriodStart: "2026-01-01T00:00:00Z", PeriodEnd: "2027-01-01T00:00:00Z", Amount: 90000})
	if err != nil {
		t.Fatal(err)
	}
	tools := procurementTools(t, repo)

	created, err := tools["accounting_tender_create"].Invoke(ctx, json.RawMessage(`{"budget_id":"`+line.ID+`","title":"Resurfacing of Mill Street"}`))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	tender := created.(accounting.Tender)
	if tender.CreatedBy != "clerk-3" || tender.BudgetID != line.ID {
		t.Fatalf("created %+v", tender)
	}

	for _, body := range []string{
		`{"tenderID":"` + tender.ID + `","supplier":"Asphalt Ltd","amount":70000}`,
		`{"tenderID":"` + tender.ID + `","supplier":"Road Co","amount":64000}`,
	} {
		quote, err := tools["accounting_quote_create"].Invoke(ctx, json.RawMessage(body))
		if err != nil {
			t.Fatalf("quote: %v", err)
		}
		if quote.(accounting.Quote).QuotedBy != "clerk-3" {
			t.Fatalf("quote %+v", quote)
		}
	}

	listed, err := tools["accounting_quote_list"].Invoke(ctx, json.RawMessage(`{"tenderID":"`+tender.ID+`"}`))
	if err != nil {
		t.Fatalf("quote list: %v", err)
	}
	if quotes := listed.([]accounting.Quote); len(quotes) != 2 || quotes[0].Supplier != "Road Co" {
		t.Fatalf("quotes %+v", quotes)
	}

	read, err := tools["accounting_tender_read"].Invoke(ctx, json.RawMessage(`{"tenderID":"`+tender.ID+`"}`))
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if view := read.(accounting.TenderView); view.QuoteCount != 2 || view.LowestAmount != 64000 {
		t.Fatalf("read %+v", view)
	}

	tenders, err := tools["accounting_tender_list"].Invoke(ctx, json.RawMessage(`{"budget_id":"`+line.ID+`"}`))
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if views := tenders.([]accounting.TenderView); len(views) != 1 || views[0].QuoteCount != 2 {
		t.Fatalf("tenders %+v", views)
	}
}
