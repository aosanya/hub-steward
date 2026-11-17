package routes_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	accounting "wakalaserver/modules/accounting"
	"wakalaserver/modules/accounting/routes"
)

type roofContract struct {
	repo      accounting.LedgerRepository
	ward      accounting.Account
	payee     accounting.Account
	retention accounting.Account
	milestone accounting.Milestone
	issued    accounting.Certificate
}

func roofCertifiedForSixty(t *testing.T) roofContract {
	t.Helper()
	ctx := context.Background()
	repo := ledgerOnMemory(t)
	open := func(category string, kind accounting.AccountType) accounting.Account {
		a, err := repo.OpenAccount(ctx, accounting.Account{Category: accounting.AccountCategory(category), Type: kind, HolderID: "zoldhalom"})
		if err != nil {
			t.Fatalf("OpenAccount(%s): %v", category, err)
		}
		return a
	}
	c := roofContract{
		repo:      repo,
		ward:      open("ward_spending", accounting.AccountTypeExpense),
		payee:     open("contractor", accounting.AccountTypeLiability),
		retention: open("retention", accounting.AccountTypeLiability),
	}
	ms, err := repo.AddMilestone(ctx, accounting.Milestone{AccountID: c.ward.ID, ContractID: "roof-1", Name: "Roof", Amount: 100})
	if err != nil {
		t.Fatalf("AddMilestone: %v", err)
	}
	c.milestone = ms
	issued, err := repo.CertifyPayment(ctx, accounting.Certificate{
		MilestoneID: ms.ID, PayeeAccountID: c.payee.ID, RetentionAccountID: c.retention.ID,
		Amount: 60, RetentionBps: 500, ReleaseDueAt: "2027-01-31T00:00:00Z", CertifiedBy: "engineer-9",
	})
	if err != nil {
		t.Fatalf("CertifyPayment: %v", err)
	}
	c.issued = issued
	return c
}

func decodeList[T any](t *testing.T, out any) []T {
	t.Helper()
	raw, err := json.Marshal(out)
	if err != nil {
		t.Fatalf("encode result: %v", err)
	}
	var list []T
	if err := json.Unmarshal(raw, &list); err != nil {
		t.Fatalf("decode result %s: %v", raw, err)
	}
	return list
}

func TestTheMilestoneListToolGivesTheCertifiedAmountAndStatusOfEachMilestone(t *testing.T) {
	c := roofCertifiedForSixty(t)
	tool, ok := budgetTools(t, c.repo)["accounting_milestone_list"]
	if !ok {
		t.Fatal("accounting_milestone_list is not served")
	}
	if tool.Action != "accounting.milestone.list" {
		t.Fatalf("action = %q, want accounting.milestone.list", tool.Action)
	}

	out, err := tool.Invoke(context.Background(), json.RawMessage(`{"accountID":"`+c.ward.ID+`"}`))
	if err != nil {
		t.Fatalf("invoke: %v", err)
	}
	got := decodeList[accounting.Milestone](t, out)

	if len(got) != 1 {
		t.Fatalf("milestones = %+v, want the one roof milestone", got)
	}
	if got[0].ID != c.milestone.ID || got[0].Amount != 100 || got[0].CertifiedAmount != 60 || got[0].Status != "part_certified" {
		t.Fatalf("milestone = %+v, want amount 100, certified 60, status part_certified", got[0])
	}
}

func TestTheMilestoneListToolHonoursTheLimit(t *testing.T) {
	c := roofCertifiedForSixty(t)
	if _, err := c.repo.AddMilestone(context.Background(), accounting.Milestone{AccountID: c.ward.ID, ContractID: "roof-1", Name: "Gutters", Amount: 40}); err != nil {
		t.Fatalf("AddMilestone: %v", err)
	}

	tool, ok := budgetTools(t, c.repo)["accounting_milestone_list"]
	if !ok {
		t.Fatal("accounting_milestone_list is not served")
	}

	out, err := tool.Invoke(context.Background(), json.RawMessage(`{"accountID":"`+c.ward.ID+`","limit":1}`))
	if err != nil {
		t.Fatalf("invoke: %v", err)
	}

	if got := decodeList[accounting.Milestone](t, out); len(got) != 1 || got[0].ID != c.milestone.ID {
		t.Fatalf("milestones = %+v, want only the oldest", got)
	}
}

func TestTheCertificateListToolGivesTheRetentionPayeeAndReleaseDate(t *testing.T) {
	c := roofCertifiedForSixty(t)
	tool, ok := budgetTools(t, c.repo)["accounting_certificate_list"]
	if !ok {
		t.Fatal("accounting_certificate_list is not served")
	}
	if tool.Action != "accounting.certificate.list" {
		t.Fatalf("action = %q, want accounting.certificate.list", tool.Action)
	}

	out, err := tool.Invoke(context.Background(), json.RawMessage(`{"milestoneID":"`+c.milestone.ID+`"}`))
	if err != nil {
		t.Fatalf("invoke: %v", err)
	}
	got := decodeList[accounting.Certificate](t, out)

	if len(got) != 1 {
		t.Fatalf("certificates = %+v, want the one certificate", got)
	}
	cert := got[0]
	if cert.ID != c.issued.ID || cert.Amount != 60 || cert.RetentionBps != 500 || cert.RetentionAmount != 3 {
		t.Fatalf("certificate = %+v, want amount 60 with 5 percent retention of 3", cert)
	}
	if cert.PayeeAccountID != c.payee.ID || cert.RetentionAccountID != c.retention.ID {
		t.Fatalf("certificate = %+v, want payee %s and retention account %s", cert, c.payee.ID, c.retention.ID)
	}
	if cert.ReleaseDueAt != "2027-01-31T00:00:00Z" || cert.CertifiedBy != "engineer-9" || cert.ReleasedAt != "" {
		t.Fatalf("certificate = %+v, want release due 2027-01-31, certified by engineer-9, not released", cert)
	}
}

func TestOnlyTheMilestoneAndCertificateListsAreServedNotTheWrites(t *testing.T) {
	served := budgetTools(t, ledgerOnMemory(t))
	for _, name := range []string{"accounting_milestone_list", "accounting_certificate_list"} {
		if _, ok := served[name]; !ok {
			t.Errorf("%s is not served", name)
		}
	}
	for _, name := range []string{"accounting_milestone_create", "accounting_certificate_create", "accounting_certificate_release_retention"} {
		if _, ok := served[name]; ok {
			t.Errorf("%s must not be served", name)
		}
	}
}

func TestAnAuthorizerThatRefusesStopsBothContractListToolsAndOneThatAllowsLetsThemThrough(t *testing.T) {
	c := roofCertifiedForSixty(t)
	arguments := map[string]string{
		"accounting_milestone_list":   `{"accountID":"` + c.ward.ID + `"}`,
		"accounting_certificate_list": `{"milestoneID":"` + c.milestone.ID + `"}`,
	}
	toolsFor := func(authorize func(context.Context, string) error) map[string]routes.Tool {
		built, err := routes.BuildTools(c.repo, routes.Mount{Authorize: authorize})
		if err != nil {
			t.Fatal(err)
		}
		byName := map[string]routes.Tool{}
		for _, tool := range built {
			byName[tool.Name] = tool
		}
		return byName
	}
	var asked []string
	refusing := toolsFor(func(_ context.Context, action string) error {
		asked = append(asked, action)
		return errors.New("no")
	})
	allowing := toolsFor(func(context.Context, string) error { return nil })

	for name, body := range arguments {
		tool, ok := refusing[name]
		if !ok {
			t.Fatalf("%s is not served", name)
		}
		if _, err := tool.Invoke(context.Background(), json.RawMessage(body)); err == nil {
			t.Errorf("%s answered although the authorizer refused", name)
		}
		if _, err := allowing[name].Invoke(context.Background(), json.RawMessage(body)); err != nil {
			t.Errorf("%s refused although the authorizer allowed: %v", name, err)
		}
	}
	if len(asked) != 2 {
		t.Fatalf("authorizer asked %v, want one question per tool", asked)
	}
}
