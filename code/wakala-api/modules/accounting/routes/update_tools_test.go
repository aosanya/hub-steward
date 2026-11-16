package routes_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"

	accounting "wakalaserver/modules/accounting"
)

func TestTheUpdateToolsCarryTheirActionsUnderAccountingManageOnly(t *testing.T) {
	tools := procurementTools(t, ledgerOnMemory(t))
	for name, action := range map[string]string{
		"accounting_bill_update":   "accounting.bill.update",
		"accounting_tender_update": "accounting.tender.update",
		"accounting_quote_update":  "accounting.quote.update",
	} {
		tool, ok := tools[name]
		if !ok || tool.Action != action {
			t.Fatalf("%s = %+v, want action %s", name, tool, action)
		}
		manage := permissionActions(t, "accounting.manage")
		view := permissionActions(t, "accounting.view")
		if !contains(manage, action) || contains(view, action) {
			t.Errorf("%s must be under accounting.manage only", action)
		}
		if agencymodels.DeclaredModuleOfAction(action) != "accounting" {
			t.Errorf("%s is not declared by the accounting module", action)
		}
	}
}

func contains(list []string, want string) bool {
	for _, item := range list {
		if item == want {
			return true
		}
	}
	return false
}

func TestATenderAndAQuoteAreCorrectedThroughTheToolsAndAClosedOneIsRefused(t *testing.T) {
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
	tender, err := repo.CreateTender(ctx, accounting.Tender{BudgetID: line.ID, Title: "Resurfacing", ClosesAt: "2099-01-01T00:00:00Z", CreatedBy: "clerk"})
	if err != nil {
		t.Fatal(err)
	}
	quote, err := repo.CreateQuote(ctx, accounting.Quote{TenderID: tender.ID, Supplier: "Road Co", Amount: 64000, QuotedBy: "clerk"})
	if err != nil {
		t.Fatal(err)
	}
	closed, err := repo.CreateTender(ctx, accounting.Tender{BudgetID: line.ID, Title: "Old", ClosesAt: "2020-01-01T00:00:00Z", CreatedBy: "clerk"})
	if err != nil {
		t.Fatal(err)
	}
	tools := procurementTools(t, repo)

	out, err := tools["accounting_tender_update"].Invoke(ctx, json.RawMessage(`{"tenderID":"`+tender.ID+`","title":"Resurfacing of Mill Street","closes_at":"2099-03-01T00:00:00Z"}`))
	if err != nil || out.(accounting.Tender).Title != "Resurfacing of Mill Street" {
		t.Fatalf("tender update = %+v, %v", out, err)
	}
	out, err = tools["accounting_quote_update"].Invoke(ctx, json.RawMessage(`{"quoteID":"`+quote.ID+`","supplier":"Road Co","amount":61000}`))
	if err != nil || out.(accounting.Quote).Amount != 61000 {
		t.Fatalf("quote update = %+v, %v", out, err)
	}
	_, err = tools["accounting_tender_update"].Invoke(ctx, json.RawMessage(`{"tenderID":"`+closed.ID+`","title":"Reopened"}`))
	if !errors.Is(err, accounting.ErrLocked) {
		t.Fatalf("closed tender update: %v, want ErrLocked", err)
	}
	if _, err := tools["accounting_tender_update"].Invoke(ctx, json.RawMessage(`{"tenderID":"`+tender.ID+`","title":"x","budget_id":"other"}`)); err == nil {
		t.Error("a tender update naming another budget line was accepted")
	}
}
