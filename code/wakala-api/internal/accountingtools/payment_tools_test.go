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

func TestThePaymentToolsAreServed(t *testing.T) {
	got := []string{}
	for name := range budgetTools(t, ledgerOnMemory(t)) {
		if strings.HasPrefix(name, "accounting_payment_") {
			got = append(got, name)
		}
	}
	sort.Strings(got)
	want := []string{"accounting_payment_list", "accounting_payment_mark_paid", "accounting_payment_reverse"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("served %v, want %v", got, want)
	}
}

func TestABillIsMarkedPaidAndListedAsAPaymentThroughTheTools(t *testing.T) {
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
	bill, err := repo.CreateBill(ctx, accounting.BillInput{
		IncomeAccountID: fees.ID, ReceivableAccountID: owed.ID, Payer: "stall-7", Amount: 900,
		DueAt: "2026-03-01T00:00:00Z", BilledBy: "clerk-1",
	})
	if err != nil {
		t.Fatal(err)
	}

	tools, err := accountingtools.BuildTools(repo, accountingtools.Mount{Caller: func(context.Context) string { return "clerk-2" }})
	if err != nil {
		t.Fatal(err)
	}
	byName := map[string]accountingtools.Tool{}
	for _, tool := range tools {
		byName[tool.Name] = tool
	}
	pay := func(body string) (any, error) {
		return byName["accounting_payment_mark_paid"].Invoke(ctx, json.RawMessage(body))
	}

	if _, err := pay(`{"billID":"` + bill.ID + `","cash_account_id":"` + cash.ID + `","paid_by":"someone-else"}`); err == nil {
		t.Fatal("a request naming its own payer was accepted")
	}

	made, err := pay(`{"billID":"` + bill.ID + `","cash_account_id":"` + cash.ID + `","narration":"paid at the counter"}`)
	if err != nil {
		t.Fatalf("mark paid: %v", err)
	}
	payment := made.(accounting.Payment)
	if payment.BillID != bill.ID || payment.Amount != 900 || payment.PaidBy != "clerk-2" || payment.Kind != "bill" {
		t.Fatalf("paid %+v", payment)
	}

	if _, err := pay(`{"billID":"` + bill.ID + `","cash_account_id":"` + cash.ID + `"}`); err == nil {
		t.Fatal("a settled bill was paid a second time")
	}

	listed, err := byName["accounting_payment_list"].Invoke(ctx, json.RawMessage(`{"bill_id":"`+bill.ID+`"}`))
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	payments := listed.([]accounting.Payment)
	if len(payments) != 1 || payments[0].ID != payment.ID {
		t.Fatalf("listed %+v", payments)
	}
	read, err := repo.GetBill(ctx, bill.ID)
	if err != nil || read.Status != "settled" {
		t.Fatalf("bill %+v %v", read, err)
	}
}
