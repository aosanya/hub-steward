package routes_test

import (
	"context"
	"encoding/json"
	"testing"

	accounting "wakalaserver/modules/accounting"
)

func TestAFinancialReportIsListedAndReadThroughTheTools(t *testing.T) {
	repo := ledgerOnMemory(t)
	ctx := context.Background()
	rent, err := repo.OpenAccount(ctx, accounting.Account{Code: "5000", Category: "rent", HolderID: "town", Type: accounting.AccountTypeExpense})
	if err != nil {
		t.Fatal(err)
	}
	cash, err := repo.OpenAccount(ctx, accounting.Account{Code: "1000", Category: "cash", HolderID: "town", Type: accounting.AccountTypeAsset})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.Post(ctx, accounting.Entry{
		DebitAccountID: rent.ID, CreditAccountID: cash.ID, Amount: 250, DocumentKind: "invoice", DocumentID: "inv-1",
		ActorID: "clerk", OccurredAt: "2026-01-12T00:00:00Z",
	}); err != nil {
		t.Fatal(err)
	}
	tools := budgetTools(t, repo)
	if _, err := tools["accounting_budget_set"].Invoke(ctx, json.RawMessage(`{"account_id":"`+rent.ID+`","name":"Road repair","department":"Public works","period_start":"2026-01-01T00:00:00Z","period_end":"2026-02-01T00:00:00Z","amount":1000}`)); err != nil {
		t.Fatalf("set: %v", err)
	}

	listed, err := tools["accounting_report_list"].Invoke(ctx, json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	reports := listed.([]accounting.FinancialReport)
	if len(reports) != 1 || reports[0].Figures.Planned != 1000 || reports[0].Figures.Spent != 250 {
		t.Fatalf("listed %+v", reports)
	}

	read, err := tools["accounting_report_read"].Invoke(ctx, json.RawMessage(`{"period_start":"2026-01-01T00:00:00Z","period_end":"2026-02-01T00:00:00Z"}`))
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	report := read.(accounting.FinancialReport)
	if report.Name != "Budget and actuals 2026-01-01 to 2026-02-01" || report.Figures.Difference != -750 || len(report.Lines) != 1 {
		t.Fatalf("read %+v", report)
	}
}

func TestAReportReadThroughTheToolHasDifferencePlannedMinusSpent(t *testing.T) {
	repo := ledgerOnMemory(t)
	ctx := context.Background()
	rent, err := repo.OpenAccount(ctx, accounting.Account{Code: "5000", Category: "rent", HolderID: "town", Type: accounting.AccountTypeExpense})
	if err != nil {
		t.Fatal(err)
	}
	cash, err := repo.OpenAccount(ctx, accounting.Account{Code: "1000", Category: "cash", HolderID: "town", Type: accounting.AccountTypeAsset})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.Post(ctx, accounting.Entry{
		DebitAccountID: rent.ID, CreditAccountID: cash.ID, Amount: 250, DocumentKind: "invoice", DocumentID: "inv-1",
		ActorID: "clerk", OccurredAt: "2026-01-12T00:00:00Z",
	}); err != nil {
		t.Fatal(err)
	}
	tools := budgetTools(t, repo)
	if _, err := tools["accounting_budget_set"].Invoke(ctx, json.RawMessage(`{"account_id":"`+rent.ID+`","name":"Road repair","department":"Public works","period_start":"2026-01-01T00:00:00Z","period_end":"2026-02-01T00:00:00Z","amount":1000}`)); err != nil {
		t.Fatalf("set: %v", err)
	}

	read, err := tools["accounting_report_read"].Invoke(ctx, json.RawMessage(`{"period_start":"2026-01-01T00:00:00Z","period_end":"2026-02-01T00:00:00Z"}`))
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	report := read.(accounting.FinancialReport)
	if report.Figures.Planned != 1000 || report.Figures.Spent != 250 || report.Figures.Difference != 750 {
		t.Fatalf("figures %+v", report.Figures)
	}
	if report.Figures.Planned-report.Figures.Spent != report.Figures.Difference {
		t.Fatalf("report planned %d minus spent %d is not difference %d", report.Figures.Planned, report.Figures.Spent, report.Figures.Difference)
	}
	if len(report.Figures.Departments) != 1 {
		t.Fatalf("departments %+v", report.Figures.Departments)
	}
	for _, d := range report.Figures.Departments {
		if d.Planned-d.Spent != d.Difference {
			t.Fatalf("department %s planned %d minus spent %d is not difference %d", d.Department, d.Planned, d.Spent, d.Difference)
		}
	}
}

func TestReadingAReportOfAnEmptyPeriodIsRefused(t *testing.T) {
	tools := budgetTools(t, ledgerOnMemory(t))
	_, err := tools["accounting_report_read"].Invoke(context.Background(), json.RawMessage(`{"period_start":"2026-01-01T00:00:00Z","period_end":"2026-02-01T00:00:00Z"}`))
	if err == nil {
		t.Fatal("an empty period was read")
	}
}
