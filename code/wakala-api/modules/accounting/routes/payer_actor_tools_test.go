package routes_test

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"testing"

	accounting "wakalaserver/modules/accounting"
	"wakalaserver/modules/accounting/routes"
)

const (
	baloghAnna = "0ace851b-6398-451a-9b23-58563e6cabd2"
	novakPeter = "7d3f2b64-1c9e-4a58-b0f1-3e8a6c5d9b71"
)

type payerFixture struct {
	t     *testing.T
	repo  accounting.LedgerRepository
	tools map[string]routes.Tool
	fees  accounting.Account
	owed  accounting.Account
	cash  accounting.Account
}

func newPayerFixture(t *testing.T) payerFixture {
	t.Helper()
	repo := ledgerOnMemory(t)
	ctx := context.Background()
	open := func(code, category string, kind accounting.AccountType) accounting.Account {
		a, err := repo.OpenAccount(ctx, accounting.Account{Code: code, Category: accounting.AccountCategory(category), HolderID: "town", Type: kind})
		if err != nil {
			t.Fatal(err)
		}
		return a
	}
	tools, err := routes.BuildTools(repo, routes.Mount{Caller: func(context.Context) string { return "clerk-1" }})
	if err != nil {
		t.Fatal(err)
	}
	byName := map[string]routes.Tool{}
	for _, tool := range tools {
		byName[tool.Name] = tool
	}
	return payerFixture{
		t: t, repo: repo, tools: byName,
		fees: open("4000", "market_fees", accounting.AccountTypeIncome),
		owed: open("1200", "receivable", accounting.AccountTypeAsset),
		cash: open("1000", "cash", accounting.AccountTypeAsset),
	}
}

func (f payerFixture) call(name, body string) (any, error) {
	f.t.Helper()
	return f.tools[name].Invoke(context.Background(), json.RawMessage(body))
}

func (f payerFixture) asMap(value any) map[string]any {
	f.t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		f.t.Fatal(err)
	}
	out := map[string]any{}
	if err := json.Unmarshal(raw, &out); err != nil {
		f.t.Fatalf("%s is not an object: %v", raw, err)
	}
	return out
}

func (f payerFixture) asRows(value any) []map[string]any {
	f.t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		f.t.Fatal(err)
	}
	out := []map[string]any{}
	if err := json.Unmarshal(raw, &out); err != nil {
		f.t.Fatalf("%s is not a list: %v", raw, err)
	}
	return out
}

func (f payerFixture) createBill(payer, actorID string, amount int64) map[string]any {
	f.t.Helper()
	body := `{"income_account_id":"` + f.fees.ID + `","receivable_account_id":"` + f.owed.ID + `","payer":"` + payer + `","amount":` + strconv.FormatInt(amount, 10) + `,"due_at":"2026-03-01T00:00:00Z"`
	if actorID != "" {
		body += `,"payer_actor_id":"` + actorID + `"`
	}
	out, err := f.call("accounting_bill_create", body+`}`)
	if err != nil {
		f.t.Fatalf("create bill for %q %q: %v", payer, actorID, err)
	}
	return f.asMap(out)
}

func (f payerFixture) listBills(filter string) []map[string]any {
	f.t.Helper()
	out, err := f.call("accounting_bill_list", filter)
	if err != nil {
		f.t.Fatalf("bill list %s: %v", filter, err)
	}
	return f.asRows(out)
}

func (f payerFixture) listPayments(filter string) []map[string]any {
	f.t.Helper()
	out, err := f.call("accounting_payment_list", filter)
	if err != nil {
		f.t.Fatalf("payment list %s: %v", filter, err)
	}
	return f.asRows(out)
}

func (f payerFixture) markPaid(billID string) map[string]any {
	f.t.Helper()
	out, err := f.call("accounting_payment_mark_paid", `{"billID":"`+billID+`","cash_account_id":"`+f.cash.ID+`"}`)
	if err != nil {
		f.t.Fatalf("mark paid %s: %v", billID, err)
	}
	return f.asMap(out)
}

func rowIDs(rows []map[string]any) []any {
	out := []any{}
	for _, row := range rows {
		out = append(out, row["id"])
	}
	return out
}

func TestABillCreatedWithAPayerActorIDReturnsItOnCreateReadAndList(t *testing.T) {
	f := newPayerFixture(t)
	created := f.createBill("Balogh Anna", baloghAnna, 900)
	if created["payer_actor_id"] != baloghAnna || created["payer"] != "Balogh Anna" {
		t.Fatalf("created %v", created)
	}

	read, err := f.call("accounting_bill_read", `{"billID":"`+created["id"].(string)+`"}`)
	if err != nil {
		t.Fatal(err)
	}
	if got := f.asMap(read)["payer_actor_id"]; got != baloghAnna {
		t.Fatalf("read payer_actor_id = %v, want %s", got, baloghAnna)
	}

	listed := f.listBills(`{}`)
	if len(listed) != 1 || listed[0]["payer_actor_id"] != baloghAnna {
		t.Fatalf("listed %v", listed)
	}
}

func TestABillCreatedWithoutAPayerActorIDCarriesNone(t *testing.T) {
	f := newPayerFixture(t)
	created := f.createBill("Balogh Anna", "", 900)
	if got, present := created["payer_actor_id"]; present && got != "" {
		t.Fatalf("payer_actor_id = %v, want none", got)
	}
}

func TestTheBillListActorIDFilterReturnsOnlyThatActorsBills(t *testing.T) {
	f := newPayerFixture(t)
	anna := f.createBill("Balogh Anna", baloghAnna, 900)
	f.createBill("Novak Peter", novakPeter, 400)

	got := f.listBills(`{"actor_id":"` + baloghAnna + `"}`)
	if len(got) != 1 || got[0]["id"] != anna["id"] {
		t.Fatalf("actor_id filter returned %v, want only %v", rowIDs(got), anna["id"])
	}
}

func TestTheBillListActorIDFilterDoesNotMatchByPayerName(t *testing.T) {
	f := newPayerFixture(t)
	f.createBill("Balogh Anna", "", 700)
	linked := f.createBill("Balogh Anna", baloghAnna, 900)

	got := f.listBills(`{"actor_id":"` + baloghAnna + `"}`)
	if len(got) != 1 || got[0]["id"] != linked["id"] {
		t.Fatalf("actor_id filter returned %v, want only the linked bill %v", rowIDs(got), linked["id"])
	}
}

func TestTheBillListActorIDFilterForAnActorWithNoBillsReturnsNothing(t *testing.T) {
	f := newPayerFixture(t)
	f.createBill("Balogh Anna", baloghAnna, 900)

	if got := f.listBills(`{"actor_id":"` + novakPeter + `"}`); len(got) != 0 {
		t.Fatalf("returned %v for an actor with no bills", rowIDs(got))
	}
}

func TestAPaymentOfABillCarriesTheBillsPayerActorIDAndPayer(t *testing.T) {
	f := newPayerFixture(t)
	bill := f.createBill("Balogh Anna", baloghAnna, 900)

	payment := f.markPaid(bill["id"].(string))
	if payment["payer_actor_id"] != baloghAnna || payment["payer"] != "Balogh Anna" {
		t.Fatalf("payment %v", payment)
	}
}

func TestThePaymentListActorIDFilterReturnsOnlyThatActorsPayments(t *testing.T) {
	f := newPayerFixture(t)
	annaPaid := f.markPaid(f.createBill("Balogh Anna", baloghAnna, 900)["id"].(string))
	f.markPaid(f.createBill("Novak Peter", novakPeter, 400)["id"].(string))
	f.markPaid(f.createBill("Balogh Anna", "", 300)["id"].(string))

	got := f.listPayments(`{"actor_id":"` + baloghAnna + `"}`)
	if len(got) != 1 || got[0]["id"] != annaPaid["id"] || got[0]["payer_actor_id"] != baloghAnna {
		t.Fatalf("actor_id filter returned %v, want only %v", got, annaPaid["id"])
	}
}

func TestThePaymentListActorIDFilterLeavesOutCertificatePayments(t *testing.T) {
	f := newPayerFixture(t)
	ctx := context.Background()
	open := func(category string, kind accounting.AccountType, holder string) accounting.Account {
		a, err := f.repo.OpenAccount(ctx, accounting.Account{Category: accounting.AccountCategory(category), HolderID: holder, Type: kind})
		if err != nil {
			t.Fatal(err)
		}
		return a
	}
	ward := open("ward_spending", accounting.AccountTypeExpense, "ward-3")
	contractor := open("contractor", accounting.AccountTypeLiability, "contractor-1")
	retention := open("retention", accounting.AccountTypeLiability, "contractor-1")
	milestone, err := f.repo.AddMilestone(ctx, accounting.Milestone{AccountID: ward.ID, ContractID: "contract-7", Name: "Foundations", Amount: 1000, DueAt: "2999-01-01T00:00:00Z"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.repo.CertifyPayment(ctx, accounting.Certificate{
		MilestoneID: milestone.ID, PayeeAccountID: contractor.ID, RetentionAccountID: retention.ID,
		Amount: 400, RetentionBps: 1000, CertifiedBy: "engineer-1", ReleaseDueAt: "2999-01-01T00:00:00Z",
	}); err != nil {
		t.Fatal(err)
	}
	annaPaid := f.markPaid(f.createBill("Balogh Anna", baloghAnna, 900)["id"].(string))

	if everything := f.listPayments(`{}`); len(everything) != 2 {
		t.Fatalf("without a filter %d payments, want the bill payment and the certificate payment", len(everything))
	}
	got := f.listPayments(`{"actor_id":"` + baloghAnna + `"}`)
	if len(got) != 1 || got[0]["id"] != annaPaid["id"] || got[0]["kind"] != "bill" {
		t.Fatalf("actor_id filter returned %v, want only the bill payment", got)
	}
}

func TestCorrectingABillWithAPayerActorIDKeepsTheLink(t *testing.T) {
	f := newPayerFixture(t)
	bill := f.createBill("Balogh Anna", "", 900)
	id := bill["id"].(string)

	out, err := f.call("accounting_bill_update", `{"billID":"`+id+`","payer":"Balogh Anna","payer_actor_id":"`+baloghAnna+`","amount":950,"due_at":"2026-03-01T00:00:00Z"}`)
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated := f.asMap(out); updated["payer_actor_id"] != baloghAnna || updated["amount"] != float64(950) {
		t.Fatalf("updated %v", updated)
	}
	if got := f.listBills(`{"actor_id":"` + baloghAnna + `"}`); len(got) != 1 || got[0]["id"] != id {
		t.Fatalf("actor_id filter returned %v after the correction", rowIDs(got))
	}
}

func TestCorrectingABillWithoutAPayerActorIDClearsTheLink(t *testing.T) {
	f := newPayerFixture(t)
	bill := f.createBill("Balogh Anna", baloghAnna, 900)
	id := bill["id"].(string)

	out, err := f.call("accounting_bill_update", `{"billID":"`+id+`","payer":"Balogh Anna","amount":900,"due_at":"2026-03-01T00:00:00Z"}`)
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if got, present := f.asMap(out)["payer_actor_id"]; present && got != "" {
		t.Fatalf("payer_actor_id = %v after a correction that sent none", got)
	}
	if got := f.listBills(`{"actor_id":"` + baloghAnna + `"}`); len(got) != 0 {
		t.Fatalf("actor_id filter still returned %v", rowIDs(got))
	}
}

func TestAMalformedPayerActorIDIsRefusedAtCreationButAWellFormedOneIsAccepted(t *testing.T) {
	f := newPayerFixture(t)
	if got := f.createBill("Balogh Anna", baloghAnna, 900); got["payer_actor_id"] != baloghAnna {
		t.Fatalf("a well-formed payer_actor_id was not kept: %v", got)
	}
	for _, malformed := range []string{"balogh-anna", "0ace851b-6398-451a-9b23-58563e6cabd", "0ace851b-6398-451a-9b23-58563e6cabdg", "0ace851b 6398 451a 9b23 58563e6cabd2"} {
		_, err := f.call("accounting_bill_create", `{"income_account_id":"`+f.fees.ID+`","receivable_account_id":"`+f.owed.ID+`","payer":"Balogh Anna","payer_actor_id":"`+malformed+`","amount":900,"due_at":"2026-03-01T00:00:00Z"}`)
		if !errors.Is(err, accounting.ErrInvalid) {
			t.Errorf("create with payer_actor_id %q = %v, want ErrInvalid", malformed, err)
		}
	}
	if got := f.listBills(`{}`); len(got) != 1 {
		t.Fatalf("%d bills after the refusals, want the one valid bill", len(got))
	}
}

func TestAMalformedPayerActorIDIsRefusedAtUpdateButAWellFormedOneIsAccepted(t *testing.T) {
	f := newPayerFixture(t)
	id := f.createBill("Balogh Anna", baloghAnna, 900)["id"].(string)
	update := func(actorID string) error {
		_, err := f.call("accounting_bill_update", `{"billID":"`+id+`","payer":"Balogh Anna","payer_actor_id":"`+actorID+`","amount":900,"due_at":"2026-03-01T00:00:00Z"}`)
		return err
	}

	if err := update(novakPeter); err != nil {
		t.Fatalf("update with a well-formed payer_actor_id: %v", err)
	}
	for _, malformed := range []string{"balogh-anna", "0ace851b-6398-451a-9b23-58563e6cabd", "0ace851b-6398-451a-9b23-58563e6cabdg"} {
		if err := update(malformed); !errors.Is(err, accounting.ErrInvalid) {
			t.Errorf("update with payer_actor_id %q = %v, want ErrInvalid", malformed, err)
		}
	}
	if got := f.listBills(`{"actor_id":"` + novakPeter + `"}`); len(got) != 1 || got[0]["id"] != id {
		t.Fatalf("the refused updates changed the link: %v", rowIDs(got))
	}
}
