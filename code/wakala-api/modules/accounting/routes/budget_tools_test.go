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

func budgetTools(t *testing.T, repo accounting.LedgerRepository) map[string]routes.Tool {
	t.Helper()
	tools, err := routes.BuildTools(repo, routes.Mount{})
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]routes.Tool{}
	for _, tool := range tools {
		out[tool.Name] = tool
	}
	return out
}

func TestOnlyTheBudgetLineToolsAreServed(t *testing.T) {
	got := []string{}
	for name := range budgetTools(t, ledgerOnMemory(t)) {
		if strings.HasPrefix(name, "accounting_budget_") {
			got = append(got, name)
		}
	}
	sort.Strings(got)
	want := []string{"accounting_budget_list", "accounting_budget_read", "accounting_budget_set"}
	if len(got) != len(want) {
		t.Fatalf("served %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("served %v, want %v", got, want)
		}
	}
}

func TestABudgetLineIsSetListedAndReadThroughTheTools(t *testing.T) {
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

	set, err := tools["accounting_budget_set"].Invoke(ctx, json.RawMessage(`{"account_id":"`+rent.ID+`","name":"Road repair","department":"Public works","period_start":"2026-01-01T00:00:00Z","period_end":"2026-02-01T00:00:00Z","amount":1000}`))
	if err != nil {
		t.Fatalf("set: %v", err)
	}
	id := set.(accounting.Budget).ID

	listed, err := tools["accounting_budget_list"].Invoke(ctx, json.RawMessage(`{"department":"Public works"}`))
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	lines := listed.([]accounting.BudgetLine)
	if len(lines) != 1 || lines[0].Name != "Road repair" || lines[0].Planned != 1000 || lines[0].Spent != 250 {
		t.Fatalf("listed %+v", lines)
	}

	read, err := tools["accounting_budget_read"].Invoke(ctx, json.RawMessage(`{"budgetID":"`+id+`"}`))
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if line := read.(accounting.BudgetLine); line.ID != id || line.Department != "Public works" || line.Spent != 250 {
		t.Fatalf("read %+v", line)
	}
}
