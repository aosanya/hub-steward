package agencies

import (
	"context"
	"strings"
	"testing"

	"gorm.io/gorm"

	mwanachamaaccounting "wakalaserver/modules/accounting"
	mwanachamaforms "wakalaserver/modules/forms"
)

type ledgerFixture struct {
	repo   mwanachamaaccounting.LedgerRepository
	ward   mwanachamaaccounting.Account
	stalls mwanachamaaccounting.Account
	writer ledgerEntryWriter
}

func newLedgerFixture(t *testing.T, db *gorm.DB) ledgerFixture {
	t.Helper()
	s, err := mwanachamaaccounting.SpecFor("landing")
	if err != nil {
		t.Fatal(err)
	}
	if err := mwanachamaaccounting.Provision(db, s); err != nil {
		t.Fatal(err)
	}
	repo, err := mwanachamaaccounting.NewLedgerRepository(db, s)
	if err != nil {
		t.Fatal(err)
	}
	open := func(category, holder string, kind mwanachamaaccounting.AccountType) mwanachamaaccounting.Account {
		a, err := repo.OpenAccount(context.Background(), mwanachamaaccounting.Account{Category: mwanachamaaccounting.AccountCategory(category), HolderID: holder, Type: kind})
		if err != nil {
			t.Fatal(err)
		}
		return a
	}
	return ledgerFixture{
		repo:   repo,
		ward:   open("market_fees", "ward-3", mwanachamaaccounting.AccountTypeAsset),
		stalls: open("stall_income", "ward-3", mwanachamaaccounting.AccountTypeIncome),
		writer: ledgerEntryWriter{ledger: func(context.Context) (mwanachamaaccounting.LedgerRepository, error) { return repo, nil }},
	}
}

func (f ledgerFixture) payment(key map[string]string, amount any) mwanachamaforms.LandedRecord {
	return mwanachamaforms.LandedRecord{
		Record: "accounting.entry",
		Key:    key,
		Fields: map[string]any{"debit_account_id": f.ward.ID, "credit_account_id": f.stalls.ID, "amount": amount, "narration": "Stall fee, synthetic"},
	}
}

func TestLedgerWriterPostsOneEntryPerKeyAndASecondSendDoesNotPostAgain(t *testing.T) {
	f := newLedgerFixture(t, sqliteDB(t))
	ctx := context.Background()
	key := map[string]string{"member": "mem-1", "send": "send-9"}
	for i := 0; i < 2; i++ {
		if err := f.writer.Write(ctx, f.payment(key, float64(4500))); err != nil {
			t.Fatal(err)
		}
	}
	entries, err := f.repo.ListEntries(ctx, f.ward.ID, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("entries = %d, want 1: a resend of the same key must not post the money twice", len(entries))
	}
	got := entries[0]
	if got.Amount != 4500 || got.ActorID != "mem-1" || got.DocumentKind != "form" || got.DocumentID == "" || got.Dimensions["landing"] != got.DocumentID {
		t.Fatalf("entry = %+v", got)
	}
	if err := f.writer.Write(ctx, f.payment(map[string]string{"member": "mem-1", "send": "send-10"}, "4500")); err != nil {
		t.Fatal(err)
	}
	if entries, _ = f.repo.ListEntries(ctx, f.ward.ID, 0); len(entries) != 2 {
		t.Fatalf("entries = %d, want 2: a different key is a different payment", len(entries))
	}
	balance, err := f.repo.Balance(ctx, f.ward.ID)
	if err != nil || balance != 9000 {
		t.Fatalf("balance = %d (%v), want 9000", balance, err)
	}
}

func TestLedgerWriterRefusesAFieldTheFormMayNotFill(t *testing.T) {
	f := newLedgerFixture(t, sqliteDB(t))
	for _, field := range []string{"actor_id", "document_id", "reverses_entry_id", "posted_at", "wage"} {
		landed := f.payment(map[string]string{"member": "mem-1"}, float64(100))
		landed.Fields[field] = "x"
		err := f.writer.Write(context.Background(), landed)
		if err == nil || !strings.Contains(err.Error(), field) || !strings.Contains(err.Error(), "amount") {
			t.Fatalf("field %q: err = %v, want a refusal naming the field and the ones allowed", field, err)
		}
	}
	entries, _ := f.repo.ListEntries(context.Background(), f.ward.ID, 0)
	if len(entries) != 0 {
		t.Fatalf("entries = %d, want none after refusals", len(entries))
	}
}

func TestLedgerWriterRefusesWhatIsNotAWholeAmountOrANamedAccountPair(t *testing.T) {
	f := newLedgerFixture(t, sqliteDB(t))
	ctx := context.Background()
	key := map[string]string{"member": "mem-1"}
	for _, amount := range []any{12.5, "twelve", true, float64(0), float64(-5)} {
		if err := f.writer.Write(ctx, f.payment(key, amount)); err == nil {
			t.Fatalf("amount %v was posted", amount)
		}
	}
	noAccounts := mwanachamaforms.LandedRecord{Record: "accounting.entry", Key: key, Fields: map[string]any{"amount": float64(100)}}
	if err := f.writer.Write(ctx, noAccounts); err == nil || !strings.Contains(err.Error(), "debit_account_id") {
		t.Fatalf("err = %v, want a refusal naming the missing accounts", err)
	}
	other := f.payment(key, float64(100))
	other.Record = "accounting.invoice"
	if err := f.writer.Write(ctx, other); err == nil {
		t.Fatal("a record this writer does not take was posted")
	}
}

func TestLedgerWriterKeepsTheFormsOwnDimensionToItself(t *testing.T) {
	f := newLedgerFixture(t, sqliteDB(t))
	landed := f.payment(map[string]string{"member": "mem-1"}, float64(100))
	landed.Fields["dimensions"] = map[string]any{"landing": "mine", "ward": "north"}
	if err := f.writer.Write(context.Background(), landed); err == nil {
		t.Fatal("a form filled the dimension that carries its own identity")
	}
	landed.Fields["dimensions"] = map[string]any{"ward": "north"}
	if err := f.writer.Write(context.Background(), landed); err != nil {
		t.Fatal(err)
	}
	entries, _ := f.repo.ListEntries(context.Background(), f.ward.ID, 0)
	if len(entries) != 1 || entries[0].Dimensions["ward"] != "north" {
		t.Fatalf("entries = %+v, want one carrying ward north", entries)
	}
}
