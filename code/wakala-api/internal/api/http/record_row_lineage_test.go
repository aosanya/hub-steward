package http

import (
	"context"
	"slices"
	"testing"

	mwanachamaaccounting "wakalaserver/modules/accounting"
	agencymodels "wakalaserver/modules/agency/models"
)

func rowReplacing(id, replaces string) agencymodels.RecordRow {
	return agencymodels.RecordRow{ID: id, Replaces: replaces}
}

func TestRowLineageWalksReplacesBackThroughOlderRows(t *testing.T) {
	rows := []agencymodels.RecordRow{rowReplacing("a", ""), rowReplacing("b", "a"), rowReplacing("c", "b"), rowReplacing("z", "")}
	got := rowLineage(rows, "c")
	if len(got) != 3 || !slices.Contains(got, "a") || !slices.Contains(got, "b") || !slices.Contains(got, "c") {
		t.Fatalf("lineage of c = %v, want a, b and c", got)
	}
	if slices.Contains(got, "z") {
		t.Fatalf("lineage of c holds an unrelated row: %v", got)
	}
}

func TestRowLineageOfARowThatReplacesNothingIsItself(t *testing.T) {
	got := rowLineage([]agencymodels.RecordRow{rowReplacing("a", ""), rowReplacing("b", "a")}, "a")
	if len(got) != 1 || got[0] != "a" {
		t.Fatalf("lineage of a = %v, want only a", got)
	}
}

func TestRowLineageOfAnUnknownRowIsItself(t *testing.T) {
	got := rowLineage(nil, "q")
	if len(got) != 1 || got[0] != "q" {
		t.Fatalf("lineage of q = %v, want only q", got)
	}
}

func TestRowLineageStopsOnACycle(t *testing.T) {
	got := rowLineage([]agencymodels.RecordRow{rowReplacing("a", "b"), rowReplacing("b", "a")}, "a")
	if len(got) != 2 {
		t.Fatalf("lineage with a cycle = %v, want a and b once each", got)
	}
}

type capturingLedger struct {
	mwanachamaaccounting.LedgerRepository
	bills    mwanachamaaccounting.BillFilter
	payments mwanachamaaccounting.PaymentFilter
}

func (c *capturingLedger) ListBills(_ context.Context, filter mwanachamaaccounting.BillFilter) ([]mwanachamaaccounting.Bill, error) {
	c.bills = filter
	return nil, nil
}

func (c *capturingLedger) ListPayments(_ context.Context, filter mwanachamaaccounting.PaymentFilter) ([]mwanachamaaccounting.Payment, error) {
	c.payments = filter
	return nil, nil
}

func TestTheLedgerExpandsARecordRowFilterIntoItsLineage(t *testing.T) {
	inner := &capturingLedger{}
	ledger := withRowLineage(inner, func(_ context.Context, id string) ([]string, error) { return []string{id, "older"}, nil })

	if _, err := ledger.ListBills(context.Background(), mwanachamaaccounting.BillFilter{RecordRowID: "newest"}); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(inner.bills.RecordRowIDs, []string{"newest", "older"}) {
		t.Fatalf("bill filter rows = %v", inner.bills.RecordRowIDs)
	}
	if _, err := ledger.ListPayments(context.Background(), mwanachamaaccounting.PaymentFilter{RecordRowID: "newest"}); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(inner.payments.RecordRowIDs, []string{"newest", "older"}) {
		t.Fatalf("payment filter rows = %v", inner.payments.RecordRowIDs)
	}
}

func TestTheLedgerLeavesAFilterWithNoRecordRowAlone(t *testing.T) {
	inner := &capturingLedger{}
	ledger := withRowLineage(inner, func(context.Context, string) ([]string, error) {
		t.Fatal("the lineage was read for a filter that names no row")
		return nil, nil
	})
	if _, err := ledger.ListBills(context.Background(), mwanachamaaccounting.BillFilter{ActorID: "someone"}); err != nil {
		t.Fatal(err)
	}
	if len(inner.bills.RecordRowIDs) != 0 || inner.bills.ActorID != "someone" {
		t.Fatalf("filter changed: %+v", inner.bills)
	}
}
