package http

import (
	"net/http"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	ledgerViewerName = "Ledger viewer"
	ledgerKeeperName = "Ledger keeper"
)

type accountingWalk struct {
	groupRoleWalk
}

func newAccountingWalk(t *testing.T) accountingWalk {
	t.Helper()
	w := newGroupRoleWalk(t)
	w.moduleRoles(t, "accounting",
		moduleRole{name: ledgerViewerName, permission: "accounting.view"},
		moduleRole{name: ledgerKeeperName, permission: "accounting.manage"},
	)
	return accountingWalk{groupRoleWalk: w}
}

func (w accountingWalk) residentHolding(t *testing.T, name, role string) (string, *http.Cookie) {
	t.Helper()
	id, cookie := w.resident(t, name, name+" group")
	if role != "" {
		w.giveRole(t, name+" group", role)
	}
	return id, cookie
}

func (w accountingWalk) get(t *testing.T, path string, as *http.Cookie) int {
	t.Helper()
	return w.call(t, "GET", "/instances/"+w.instance+"/accounting"+path, nil, as).Code
}

func (w accountingWalk) openAccount(t *testing.T, as *http.Cookie) int {
	t.Helper()
	body := map[string]any{"code": "5000", "category": "rent", "holder_id": "town", "type": "expense"}
	return w.call(t, "POST", "/instances/"+w.instance+"/accounting/accounts", body, as).Code
}

var accountingReads = []string{"/budgets", "/bills", "/reports", "/accounts"}

func TestAccountingRoutes_AResidentWhoseRoleHoldsAccountingViewReadsBudgetsBillsAndReports(t *testing.T) {
	w := newAccountingWalk(t)
	_, controller := w.residentHolding(t, "Fiona", ledgerViewerName)
	for _, path := range accountingReads {
		if code := w.get(t, path, controller); code != http.StatusOK {
			t.Errorf("a resident holding accounting.view reads %s: %d, want 200", path, code)
		}
	}
}

func TestAccountingRoutes_AResidentHoldingOnlyAccountingViewCannotWrite(t *testing.T) {
	w := newAccountingWalk(t)
	_, controller := w.residentHolding(t, "Fiona", ledgerViewerName)
	if code := w.openAccount(t, controller); code != http.StatusForbidden {
		t.Fatalf("a resident holding only accounting.view opens an account: %d, want 403", code)
	}
}

func TestAccountingRoutes_AResidentWhoseRoleHoldsAccountingManageReadsAndWrites(t *testing.T) {
	w := newAccountingWalk(t)
	_, keeper := w.residentHolding(t, "Kofi", ledgerKeeperName)
	if code := w.openAccount(t, keeper); code != http.StatusCreated {
		t.Fatalf("a resident holding accounting.manage opens an account: %d, want 201", code)
	}
	for _, path := range accountingReads {
		if code := w.get(t, path, keeper); code != http.StatusOK {
			t.Errorf("a resident holding accounting.manage reads %s: %d, want 200", path, code)
		}
	}
}

func TestAccountingRoutes_AResidentWithNoRoleIsRefusedAsToday(t *testing.T) {
	w := newAccountingWalk(t)
	_, plain := w.residentHolding(t, "Rae", "")
	for _, path := range accountingReads {
		if code := w.get(t, path, plain); code != http.StatusNotFound {
			t.Errorf("a resident with no role reads %s: %d, want 404", path, code)
		}
	}
	if code := w.openAccount(t, plain); code != http.StatusNotFound {
		t.Errorf("a resident with no role opens an account: %d, want 404", code)
	}
}

func TestAccountingRoutes_AResidentHoldingAnotherPermissionIsRefusedAsToday(t *testing.T) {
	w := newAccountingWalk(t)
	_, reader := w.residentHolding(t, "Rita", "Reader")
	for _, path := range accountingReads {
		if code := w.get(t, path, reader); code != http.StatusNotFound {
			t.Errorf("a resident holding only task.read reads %s: %d, want 404", path, code)
		}
	}
}

func TestAccountingRoutes_TheOwnerStillReadsAndWrites(t *testing.T) {
	w := newAccountingWalk(t)
	if code := w.openAccount(t, w.owner); code != http.StatusCreated {
		t.Fatalf("the owner opens an account: %d, want 201", code)
	}
	for _, path := range accountingReads {
		if code := w.get(t, path, w.owner); code != http.StatusOK {
			t.Errorf("the owner reads %s: %d, want 200", path, code)
		}
	}
}

func TestAccountingRoutes_AStrangerIsStillTurnedAway(t *testing.T) {
	w := newAccountingWalk(t)
	stranger := w.cookieFor(t, "a-stranger")
	for _, path := range accountingReads {
		if code := w.get(t, path, stranger); code != http.StatusNotFound {
			t.Errorf("a stranger reads %s: %d, want 404", path, code)
		}
	}
}

func (w accountingWalk) toolAs(t *testing.T, subject, tool string, args map[string]any) *mcp.CallToolResult {
	t.Helper()
	args["instance_id"] = w.instance
	return w.callTool(t, subject, tool, args)
}

var accountingReadTools = []string{"accounting_budget_list", "accounting_bill_list", "accounting_report_list", "accounting_account_list"}

func TestAccountingTools_AResidentWhoseRoleHoldsAccountingViewListsBudgetsBillsAndReports(t *testing.T) {
	w := newAccountingWalk(t)
	id, _ := w.residentHolding(t, "Fiona", ledgerViewerName)
	for _, tool := range accountingReadTools {
		if out := w.toolAs(t, id, tool, map[string]any{}); out.IsError {
			t.Errorf("%s as a resident holding accounting.view: %s", tool, toolErrorText(out))
		}
	}
}

func TestAccountingTools_AResidentHoldingOnlyAccountingViewCannotWrite(t *testing.T) {
	w := newAccountingWalk(t)
	id, _ := w.residentHolding(t, "Fiona", ledgerViewerName)
	out := w.toolAs(t, id, "accounting_budget_delete", map[string]any{"account_id": "x", "period_start": "2026-03-01T00:00:00Z"})
	if !out.IsError || !strings.Contains(toolErrorText(out), "accounting.manage") {
		t.Fatalf("a resident holding only accounting.view deletes a budget: error %v %q, want a refusal naming accounting.manage", out.IsError, toolErrorText(out))
	}
}

func TestAccountingTools_AResidentWhoseRoleHoldsAccountingManageWrites(t *testing.T) {
	w := newAccountingWalk(t)
	id, _ := w.residentHolding(t, "Kofi", ledgerKeeperName)
	out := w.toolAs(t, id, "accounting_budget_delete", map[string]any{"account_id": "x", "period_start": "2026-03-01T00:00:00Z"})
	if strings.Contains(toolErrorText(out), "accounting.manage") || strings.Contains(toolErrorText(out), instanceNotFoundText) {
		t.Fatalf("a resident holding accounting.manage is refused: %q", toolErrorText(out))
	}
}

func TestAccountingTools_AResidentWithNoRoleIsRefused(t *testing.T) {
	w := newAccountingWalk(t)
	id, _ := w.residentHolding(t, "Rae", "")
	for _, tool := range accountingReadTools {
		if out := w.toolAs(t, id, tool, map[string]any{}); !out.IsError {
			t.Errorf("%s as a resident with no role was admitted", tool)
		}
	}
}

func TestAccountingTools_TheOwnerStillListsBudgets(t *testing.T) {
	w := newAccountingWalk(t)
	if out := w.toolAs(t, "test-owner", "accounting_budget_list", map[string]any{}); out.IsError {
		t.Fatalf("the owner lists budgets: %s", toolErrorText(out))
	}
}
