package accountingtools_test

import (
	"strconv"
	"strings"
	"testing"
)

const (
	ceramicsStall = "5b1d9c20-77aa-4e0c-9a31-0f5d2b6c8e11"
	bakeryRow     = "c40a8e12-3d5f-4b97-8a60-91e7d2f4b3a5"
)

func (f payerFixture) createBillForRow(payer, rowID string, amount int64) map[string]any {
	f.t.Helper()
	body := `{"income_account_id":"` + f.fees.ID + `","receivable_account_id":"` + f.owed.ID + `","payer":"` + payer + `","amount":` + strconv.FormatInt(amount, 10) + `,"due_at":"2026-03-01T00:00:00Z"`
	if rowID != "" {
		body += `,"payer_record_row_id":"` + rowID + `"`
	}
	out, err := f.call("accounting_bill_create", body+`}`)
	if err != nil {
		f.t.Fatalf("create bill for %q %q: %v", payer, rowID, err)
	}
	return f.asMap(out)
}

func TestABillCreatedWithAPayerRecordRowIDReturnsItOnCreateReadAndList(t *testing.T) {
	f := newPayerFixture(t)
	created := f.createBillForRow("Kerámia Bt", ceramicsStall, 900)
	if created["payer_record_row_id"] != ceramicsStall {
		t.Fatalf("created %v", created)
	}
	read, err := f.call("accounting_bill_read", `{"billID":"`+created["id"].(string)+`"}`)
	if err != nil {
		t.Fatal(err)
	}
	if got := f.asMap(read)["payer_record_row_id"]; got != ceramicsStall {
		t.Fatalf("read payer_record_row_id = %v, want %s", got, ceramicsStall)
	}
	listed := f.listBills(`{}`)
	if len(listed) != 1 || listed[0]["payer_record_row_id"] != ceramicsStall {
		t.Fatalf("listed %v", listed)
	}
}

func TestABillWithANonUUIDPayerRecordRowIDIsRefused(t *testing.T) {
	f := newPayerFixture(t)
	_, err := f.call("accounting_bill_create", `{"income_account_id":"`+f.fees.ID+`","receivable_account_id":"`+f.owed.ID+`","payer":"Kerámia Bt","amount":900,"due_at":"2026-03-01T00:00:00Z","payer_record_row_id":"the ceramics stall"}`)
	if err == nil || !strings.Contains(err.Error(), "payer_record_row_id") {
		t.Fatalf("error %v, want a refusal naming payer_record_row_id", err)
	}
}

func TestTheBillListRecordRowIDFilterReturnsOnlyThatRowsBills(t *testing.T) {
	f := newPayerFixture(t)
	stall := f.createBillForRow("Kerámia Bt", ceramicsStall, 900)
	f.createBillForRow("Pékség Kft", bakeryRow, 400)
	f.createBillForRow("Kerámia Bt", "", 300)

	got := f.listBills(`{"record_row_id":"` + ceramicsStall + `"}`)
	if len(got) != 1 || got[0]["id"] != stall["id"] {
		t.Fatalf("record_row_id filter returned %v, want only %v", rowIDs(got), stall["id"])
	}
}

func TestABillWithNoRecordRowIDIsListedForNoRow(t *testing.T) {
	f := newPayerFixture(t)
	f.createBillForRow("Kerámia Bt", "", 300)
	if got := f.listBills(`{"record_row_id":"` + ceramicsStall + `"}`); len(got) != 0 {
		t.Fatalf("returned %v for a row no bill names", rowIDs(got))
	}
}

func TestAPaymentOfABillCarriesTheBillsPayerRecordRowID(t *testing.T) {
	f := newPayerFixture(t)
	bill := f.createBillForRow("Kerámia Bt", ceramicsStall, 900)
	payment := f.markPaid(bill["id"].(string))
	if payment["payer_record_row_id"] != ceramicsStall {
		t.Fatalf("payment %v", payment)
	}
}

func TestThePaymentListRecordRowIDFilterReturnsOnlyThatRowsPayments(t *testing.T) {
	f := newPayerFixture(t)
	stall := f.markPaid(f.createBillForRow("Kerámia Bt", ceramicsStall, 900)["id"].(string))
	f.markPaid(f.createBillForRow("Pékség Kft", bakeryRow, 400)["id"].(string))

	got := f.listPayments(`{"record_row_id":"` + ceramicsStall + `"}`)
	if len(got) != 1 || got[0]["id"] != stall["id"] {
		t.Fatalf("record_row_id filter returned %v, want only %v", rowIDs(got), stall["id"])
	}
}

func TestCorrectingABillCanNameARecordRow(t *testing.T) {
	f := newPayerFixture(t)
	bill := f.createBillForRow("Kerámia Bt", "", 900)
	out, err := f.call("accounting_bill_update", `{"billID":"`+bill["id"].(string)+`","payer":"Kerámia Bt","payer_record_row_id":"`+ceramicsStall+`","amount":900,"due_at":"2026-03-01T00:00:00Z"}`)
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if f.asMap(out)["payer_record_row_id"] != ceramicsStall {
		t.Fatalf("updated %v", out)
	}
}
