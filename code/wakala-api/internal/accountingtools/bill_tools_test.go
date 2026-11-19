package accountingtools_test

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"testing"

	accounting "github.com/aosanya/mwanachama-backend-accounting"
	"wakalaserver/internal/accountingtools"
)

func TestTheBillToolsAreServed(t *testing.T) {
	got := []string{}
	for name := range budgetTools(t, ledgerOnMemory(t)) {
		if strings.HasPrefix(name, "accounting_bill_") {
			got = append(got, name)
		}
	}
	sort.Strings(got)
	want := []string{"accounting_bill_create", "accounting_bill_list", "accounting_bill_read", "accounting_bill_update"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("served %v, want %v", got, want)
	}
}

func TestABillIsCreatedListedAndReadThroughTheTools(t *testing.T) {
	repo := ledgerOnMemory(t)
	ctx := context.Background()
	open := func(code, category string, kind accounting.AccountType) accounting.Account {
		a, err := repo.OpenAccount(ctx, accounting.Account{Code: code, Category: accounting.AccountCategory(category), HolderID: "town", Type: kind})
		if err != nil {
			t.Fatal(err)
		}
		return a
	}
	fees := open("4000", "market_fees", accounting.AccountTypeIncome)
	owed := open("1200", "receivable", accounting.AccountTypeAsset)
	cash := open("1000", "cash", accounting.AccountTypeAsset)

	tools, err := accountingtools.BuildTools(repo, accountingtools.Mount{Caller: func(context.Context) string { return "clerk-1" }})
	if err != nil {
		t.Fatal(err)
	}
	byName := map[string]accountingtools.Tool{}
	for _, tool := range tools {
		byName[tool.Name] = tool
	}

	if _, err := byName["accounting_bill_create"].Invoke(ctx, json.RawMessage(
		`{"income_account_id":"`+fees.ID+`","receivable_account_id":"`+owed.ID+`","amount":1,"due_at":"2026-03-01T00:00:00Z","billed_by":"someone-else"}`)); err == nil {
		t.Fatal("a request naming its own biller was accepted")
	}

	created, err := byName["accounting_bill_create"].Invoke(ctx, json.RawMessage(
		`{"income_account_id":"`+fees.ID+`","receivable_account_id":"`+owed.ID+`","payer":"stall-7","amount":900,"due_at":"2026-03-01T00:00:00Z","narration":"March stall fee"}`))
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	bill := created.(accounting.Bill)
	if bill.BilledBy != "clerk-1" || bill.Amount != 900 || bill.Payer != "stall-7" {
		t.Fatalf("created %+v", bill)
	}

	if _, err := repo.Post(ctx, accounting.Entry{
		DebitAccountID: cash.ID, CreditAccountID: owed.ID, Amount: 400, DocumentKind: "receipt", DocumentID: "rcpt-1",
		ActorID: "clerk-1", SettlesEntryID: bill.ID,
	}); err != nil {
		t.Fatal(err)
	}

	listed, err := byName["accounting_bill_list"].Invoke(ctx, json.RawMessage(`{"status":"overdue","as_of":"2026-03-11T00:00:00Z","payer":"stall-7"}`))
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	bills := listed.([]accounting.Bill)
	if len(bills) != 1 || bills[0].Settled != 400 || bills[0].Outstanding != 500 || bills[0].DaysOverdue != 10 {
		t.Fatalf("listed %+v", bills)
	}

	read, err := byName["accounting_bill_read"].Invoke(ctx, json.RawMessage(`{"billID":"`+bill.ID+`"}`))
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if got := read.(accounting.Bill); got.ID != bill.ID || got.Outstanding != 500 {
		t.Fatalf("read %+v", got)
	}
}
