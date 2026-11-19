package accountingtools_test

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"testing"

	accounting "github.com/aosanya/mwanachama-backend-accounting"
)

func TestOnlyTheAccountListToolIsServed(t *testing.T) {
	got := []string{}
	for name := range budgetTools(t, ledgerOnMemory(t)) {
		if strings.HasPrefix(name, "accounting_account_") {
			got = append(got, name)
		}
	}
	sort.Strings(got)
	if strings.Join(got, ",") != "accounting_account_list" {
		t.Fatalf("served %v, want only accounting_account_list", got)
	}
}

func TestTheChartOfAccountsIsListedThroughTheTool(t *testing.T) {
	repo := ledgerOnMemory(t)
	ctx := context.Background()
	for _, a := range []accounting.Account{
		{Code: "1000", Name: "Cash at bank", Category: "cash", HolderID: "town", Type: accounting.AccountTypeAsset},
		{Code: "4000", Name: "Market fees", Category: "market_fees", HolderID: "town", Type: accounting.AccountTypeIncome},
	} {
		if _, err := repo.OpenAccount(ctx, a); err != nil {
			t.Fatal(err)
		}
	}
	tool, ok := budgetTools(t, repo)["accounting_account_list"]
	if !ok {
		t.Fatal("accounting_account_list is not served")
	}
	listed, err := tool.Invoke(ctx, json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	accounts := listed.([]accounting.Account)
	if len(accounts) != 2 || accounts[0].Category != "cash" || accounts[0].Type != accounting.AccountTypeAsset || accounts[1].Category != "market_fees" {
		t.Fatalf("listed %+v", accounts)
	}
}
