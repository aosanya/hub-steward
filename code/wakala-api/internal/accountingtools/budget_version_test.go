package accountingtools_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	accounting "github.com/aosanya/mwanachama-backend-accounting"
	accountingroutes "github.com/aosanya/mwanachama-backend-accounting/routes"
	"wakalaserver/internal/accountingtools"
)

const (
	roadRepairJanuary = `"name":"Road repair","department":"Public works","period_start":"2026-01-01T00:00:00Z","period_end":"2026-02-01T00:00:00Z"`
	longAgo           = "2020-01-01T00:00:00Z"
)

func budgetWithALine(t *testing.T) (map[string]accountingtools.Tool, accounting.LedgerRepository, string, accounting.Budget) {
	t.Helper()
	repo := ledgerOnMemory(t)
	rent, err := repo.OpenAccount(context.Background(), accounting.Account{Code: "5000", Category: "rent", HolderID: "town", Type: accounting.AccountTypeExpense})
	if err != nil {
		t.Fatal(err)
	}
	tools := budgetTools(t, repo)
	first, err := tools["accounting_budget_set"].Invoke(context.Background(), json.RawMessage(`{"account_id":"`+rent.ID+`",`+roadRepairJanuary+`,"amount":1000}`))
	if err != nil {
		t.Fatalf("first set: %v", err)
	}
	return tools, repo, rent.ID, first.(accounting.Budget)
}

func setBudget(tools map[string]accountingtools.Tool, accountID, extra string, amount int) (any, error) {
	body := `{"account_id":"` + accountID + `",` + roadRepairJanuary + `,"amount":` + itoa(amount) + extra + `}`
	return tools["accounting_budget_set"].Invoke(context.Background(), json.RawMessage(body))
}

func itoa(n int) string {
	b, _ := json.Marshal(n)
	return string(b)
}

func refusesTheVersionArgument(t *testing.T, err error) {
	t.Helper()
	if err == nil || !strings.Contains(err.Error(), `takes no argument "version"`) {
		t.Fatalf("refusal %v", err)
	}
}

func TestBudgetSetRefusesTheVersionArgumentAndLeavesTheLineAlone(t *testing.T) {
	tools, repo, accountID, first := budgetWithALine(t)

	_, err := setBudget(tools, accountID, `,"version":"`+first.SetAt+`"`, 1200)
	refusesTheVersionArgument(t, err)
	lines, err := repo.ListBudgetLines(context.Background(), accounting.BudgetLineFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 1 || lines[0].Planned != 1000 || lines[0].SetAt != first.SetAt {
		t.Fatalf("a refused save changed the line: %+v", lines)
	}
}

func TestBudgetSetRefusesAnOldVersionAsAnUnknownArgumentNotAsStale(t *testing.T) {
	tools, repo, accountID, first := budgetWithALine(t)

	_, err := setBudget(tools, accountID, `,"version":"`+longAgo+`"`, 1200)
	refusesTheVersionArgument(t, err)
	lines, err := repo.ListBudgetLines(context.Background(), accounting.BudgetLineFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 1 || lines[0].Planned != 1000 || lines[0].SetAt != first.SetAt {
		t.Fatalf("a refused save changed the line: %+v", lines)
	}
}

func TestBudgetSetNoLongerNamesTheFieldTheCallerChanged(t *testing.T) {
	tools, _, accountID, _ := budgetWithALine(t)

	body := `{"account_id":"` + accountID + `","name":"Road resurfacing","department":"Public works","period_start":"2026-01-01T00:00:00Z","period_end":"2026-02-01T00:00:00Z","amount":1000,"version":"` + longAgo + `"}`
	_, err := tools["accounting_budget_set"].Invoke(context.Background(), json.RawMessage(body))
	refusesTheVersionArgument(t, err)
}

func TestBudgetSetWithNoVersionIsAccepted(t *testing.T) {
	tools, _, accountID, _ := budgetWithALine(t)

	got, err := setBudget(tools, accountID, ``, 1500)
	if err != nil {
		t.Fatalf("set with no version: %v", err)
	}
	if got.(accounting.Budget).Amount != 1500 {
		t.Fatalf("set %+v", got)
	}
}

func TestBudgetSetOfALineThatDoesNotExistYetStillRefusesTheVersionArgument(t *testing.T) {
	repo := ledgerOnMemory(t)
	rent, err := repo.OpenAccount(context.Background(), accounting.Account{Code: "5000", Category: "rent", HolderID: "town", Type: accounting.AccountTypeExpense})
	if err != nil {
		t.Fatal(err)
	}
	tools := budgetTools(t, repo)

	_, err = setBudget(tools, rent.ID, `,"version":"`+longAgo+`"`, 1000)
	refusesTheVersionArgument(t, err)
}

func TestBudgetSetSchemaDeclaresNoVersion(t *testing.T) {
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
	if _, present := schema.Properties["version"]; present {
		t.Fatalf("version property %+v", schema.Properties["version"])
	}
}

func TestBudgetSetWithAVersionOverHTTPIsABadRequestNamingTheField(t *testing.T) {
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

	rec := serve(list, http.MethodPut, "/budgets", `{"account_id":"`+rent.ID+`",`+roadRepairJanuary+`,"amount":1200,"version":"`+longAgo+`"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, body %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), "version is not a field this request takes") {
		t.Fatalf("body %s", rec.Body)
	}
}
