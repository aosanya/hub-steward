package accountingtools_test

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
		"accounting.dimension.totals", "accounting.dimension.entries",
		"accounting.milestone.list", "accounting.certificate.list",
	}
	writeActions := []string{
		"accounting.account.open", "accounting.account.close",
		"accounting.entry.post",
		"accounting.budget.set", "accounting.budget.delete",
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
		"accounting_dimension_totals", "accounting_dimension_entries",
		"accounting_milestone_list", "accounting_certificate_list",
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

func TestTheUpwardReportListIsReadableAndTheSendNeedsAccountingManage(t *testing.T) {
	view := permissionActions(t, "accounting.view")
	manage := permissionActions(t, "accounting.manage")
	for _, p := range [][]string{view, manage} {
		if !slices.Contains(p, "accounting.upward_report.list") {
			t.Errorf("accounting.upward_report.list missing from %v", p)
		}
	}
	if slices.Contains(view, "accounting.upward_report.send") {
		t.Error("accounting.upward_report.send must not be under accounting.view")
	}
	if !slices.Contains(manage, "accounting.upward_report.send") {
		t.Error("accounting.upward_report.send missing from accounting.manage")
	}
	for _, name := range []string{"accounting_upward_report_send", "accounting_upward_report_list"} {
		tool, ok := budgetTools(t, ledgerOnMemory(t))[name]
		if !ok {
			t.Fatalf("no tool %s", name)
		}
		if !slices.Contains(manage, tool.Action) {
			t.Errorf("%s action %s is not under accounting.manage", name, tool.Action)
		}
	}
}

func TestTheContractWritesAreNotUnderAccountingView(t *testing.T) {
	view := permissionActions(t, "accounting.view")
	for _, a := range []string{"accounting.milestone.create", "accounting.certificate.create", "accounting.certificate.release_retention"} {
		if slices.Contains(view, a) {
			t.Errorf("%s must not be under accounting.view", a)
		}
	}
}
