package routes_test

import (
	"slices"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

func permissionActions(t *testing.T, code string) []string {
	t.Helper()
	p, ok := agencymodels.LookupPermission(code)
	if !ok {
		t.Fatalf("catalog has no permission %q", code)
	}
	if p.Module != "accounting" || p.Locked {
		t.Fatalf("%s = module %q locked %v, want module accounting unlocked", code, p.Module, p.Locked)
	}
	return p.Actions
}

func TestAccountingViewReadsAndAccountingManageAlsoWrites(t *testing.T) {
	readActions := []string{
		"accounting.account.list", "accounting.account.read", "accounting.account.balance",
		"accounting.entry.list",
		"accounting.budget.list", "accounting.budget.read",
		"accounting.report.list", "accounting.report.read",
	}
	writeActions := []string{
		"accounting.account.open", "accounting.account.close",
		"accounting.entry.post",
		"accounting.budget.set",
	}
	view := permissionActions(t, "accounting.view")
	manage := permissionActions(t, "accounting.manage")
	for _, a := range readActions {
		if !slices.Contains(view, a) || !slices.Contains(manage, a) {
			t.Errorf("%s missing from accounting.view or accounting.manage", a)
		}
	}
	for _, a := range writeActions {
		if slices.Contains(view, a) {
			t.Errorf("%s must not be under accounting.view", a)
		}
		if !slices.Contains(manage, a) {
			t.Errorf("%s missing from accounting.manage", a)
		}
	}
}

func TestEveryBudgetAndReportToolActionIsUnderAnAccountingPermission(t *testing.T) {
	for _, name := range []string{
		"accounting_budget_set", "accounting_budget_list", "accounting_budget_read",
		"accounting_report_list", "accounting_report_read",
	} {
		tool, ok := budgetTools(t, ledgerOnMemory(t))[name]
		if !ok {
			t.Fatalf("no tool %s", name)
		}
		if agencymodels.DeclaredModuleOfAction(tool.Action) != "accounting" {
			t.Errorf("%s action %s is not declared under the accounting module", name, tool.Action)
		}
	}
}
