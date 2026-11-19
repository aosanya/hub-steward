package accountingtools_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	accounting "github.com/aosanya/mwanachama-backend-accounting"
	accountingroutes "github.com/aosanya/mwanachama-backend-accounting/routes"
)

func TestBudgetSetWithCreateOnAUsedAccountAndPeriodIsRefusedNamingBoth(t *testing.T) {
	tools, _, accountID, _ := budgetWithALine(t)

	_, err := setBudget(tools, accountID, `,"create":true`, 1200)
	if err == nil {
		t.Fatal("an add on an account and period that already hold a line was accepted")
	}
	if !strings.Contains(err.Error(), accountID) {
		t.Fatalf("refusal %q does not name the account %s", err.Error(), accountID)
	}
	if !strings.Contains(err.Error(), "2026-01-01") {
		t.Fatalf("refusal %q does not name the period starting 2026-01-01", err.Error())
	}
}

func TestBudgetSetWithCreateOnAUsedAccountAndPeriodLeavesTheExistingLineUnchanged(t *testing.T) {
	tools, repo, accountID, first := budgetWithALine(t)

	if _, err := setBudget(tools, accountID, `,"create":true`, 1200); err == nil {
		t.Fatal("an add on an account and period that already hold a line was accepted")
	}

	lines, err := repo.ListBudgetLines(context.Background(), accounting.BudgetLineFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 1 || lines[0].Planned != 1000 || lines[0].SetAt != first.SetAt {
		t.Fatalf("a refused add changed the line: %+v", lines)
	}
}

func TestBudgetSetWithCreateOnAFreeAccountAndPeriodSaves(t *testing.T) {
	tools, repo, accountID, _ := budgetWithALine(t)

	body := `{"account_id":"` + accountID + `","name":"Winter salt","department":"Public works","period_start":"2026-03-01T00:00:00Z","period_end":"2026-04-01T00:00:00Z","amount":4000,"create":true}`
	got, err := tools["accounting_budget_set"].Invoke(context.Background(), json.RawMessage(body))
	if err != nil {
		t.Fatalf("add on a free period: %v", err)
	}
	if got.(accounting.Budget).Amount != 4000 {
		t.Fatalf("set %+v", got)
	}
	lines, err := repo.ListBudgetLines(context.Background(), accounting.BudgetLineFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 2 {
		t.Fatalf("lines %+v", lines)
	}
}

func TestBudgetSetWithCreateOnAFreeAccountWithNoLineAtAllSaves(t *testing.T) {
	repo := ledgerOnMemory(t)
	rent, err := repo.OpenAccount(context.Background(), accounting.Account{Code: "5000", Category: "rent", HolderID: "town", Type: accounting.AccountTypeExpense})
	if err != nil {
		t.Fatal(err)
	}
	tools := budgetTools(t, repo)

	got, err := setBudget(tools, rent.ID, `,"create":true`, 1000)
	if err != nil {
		t.Fatalf("add with create true: %v", err)
	}
	if got.(accounting.Budget).Amount != 1000 {
		t.Fatalf("set %+v", got)
	}
}

func TestBudgetSetSchemaDeclaresAnOptionalBooleanCreate(t *testing.T) {
	tools, _, _, _ := budgetWithALine(t)

	var schema struct {
		Properties map[string]struct {
			Type string `json:"type"`
		} `json:"properties"`
		Required []string `json:"required"`
	}
	if err := json.Unmarshal(tools["accounting_budget_set"].InputSchema, &schema); err != nil {
		t.Fatal(err)
	}
	if schema.Properties["create"].Type != "boolean" {
		t.Fatalf("create property %+v", schema.Properties["create"])
	}
	for _, name := range schema.Required {
		if name == "create" {
			t.Fatal("create is required")
		}
	}
}

func TestBudgetSetWithCreateOnAUsedLineOverHTTPIsAConflictNamingAccountAndPeriod(t *testing.T) {
	repo := ledgerOnMemory(t)
	rent, err := repo.OpenAccount(context.Background(), accounting.Account{Code: "5000", Category: "rent", HolderID: "town", Type: accounting.AccountTypeExpense})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.SetBudget(context.Background(), accounting.Budget{AccountID: rent.ID, Name: "Road repair", Department: "Public works", PeriodStart: "2026-01-01T00:00:00Z", PeriodEnd: "2026-02-01T00:00:00Z", Amount: 1000}); err != nil {
		t.Fatal(err)
	}
	list, err := accountingroutes.Build(repo)
	if err != nil {
		t.Fatal(err)
	}

	rec := serve(list, http.MethodPut, "/budgets", `{"account_id":"`+rent.ID+`",`+roadRepairJanuary+`,"amount":1200,"create":true}`)
	if rec.Code != http.StatusConflict {
		t.Fatalf("status %d, body %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), rent.ID) || !strings.Contains(rec.Body.String(), "2026-01-01") {
		t.Fatalf("body %s", rec.Body)
	}
}
