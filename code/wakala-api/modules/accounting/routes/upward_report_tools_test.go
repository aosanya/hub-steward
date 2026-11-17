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

func upwardReportTools(t *testing.T, repo accounting.LedgerRepository) map[string]routes.Tool {
	t.Helper()
	tools, err := routes.BuildTools(repo, routes.Mount{Caller: func(context.Context) string { return "officer-zoldhalom" }})
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]routes.Tool{}
	for _, tool := range tools {
		out[tool.Name] = tool
	}
	return out
}

func TestTheUpwardReportToolsAreServed(t *testing.T) {
	got := []string{}
	for name := range upwardReportTools(t, ledgerOnMemory(t)) {
		if strings.HasPrefix(name, "accounting_upward_report_") {
			got = append(got, name)
		}
	}
	sort.Strings(got)
	want := []string{"accounting_upward_report_list", "accounting_upward_report_send"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("served %v, want %v", got, want)
	}
}

func TestAReportIsSentUpwardAndListedThroughTheToolsWithTheCallerRecorded(t *testing.T) {
	repo := ledgerOnMemory(t)
	ctx := context.Background()
	roads, err := repo.OpenAccount(ctx, accounting.Account{Code: "5100", Category: "roads", HolderID: "zoldhalom", Type: accounting.AccountTypeExpense})
	if err != nil {
		t.Fatal(err)
	}
	cash, err := repo.OpenAccount(ctx, accounting.Account{Code: "1000", Category: "cash", HolderID: "zoldhalom", Type: accounting.AccountTypeAsset})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.Post(ctx, accounting.Entry{
		DebitAccountID: roads.ID, CreditAccountID: cash.ID, Amount: 250, DocumentKind: "invoice", DocumentID: "inv-1",
		ActorID: "clerk", OccurredAt: "2026-07-12T00:00:00Z",
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.SetBudget(ctx, accounting.Budget{
		AccountID: roads.ID, Name: "Road repair", Department: "Public works",
		PeriodStart: "2026-07-01T00:00:00Z", PeriodEnd: "2026-10-01T00:00:00Z", Amount: 1000,
	}); err != nil {
		t.Fatal(err)
	}
	tools := upwardReportTools(t, repo)
	send := func(body string) (any, error) {
		return tools["accounting_upward_report_send"].Invoke(ctx, json.RawMessage(body))
	}
	period := `"period_start":"2026-07-01T00:00:00Z","period_end":"2026-10-01T00:00:00Z"`

	if _, err := send(`{` + period + `,"kind":"spending_by_department","sent_by":"someone-else"}`); err == nil {
		t.Fatal("a request naming its own sender was accepted")
	}
	if _, err := send(`{` + period + `,"kind":"spending_by_neighbourhood"}`); err == nil {
		t.Fatal("an unknown kind was accepted")
	}
	if _, err := send(`{"period_start":"2025-07-01T00:00:00Z","period_end":"2025-10-01T00:00:00Z","kind":"budget_and_actuals"}`); err == nil {
		t.Fatal("a period with no budget lines was sent")
	}

	made, err := send(`{` + period + `,"kind":"budget_and_actuals"}`)
	if err != nil {
		t.Fatalf("send: %v", err)
	}
	sent := made.(accounting.UpwardReport)
	if sent.SentBy != "officer-zoldhalom" || sent.Planned != 1000 || sent.Spent != 250 || sent.Difference != -750 || len(sent.Lines) != 1 {
		t.Fatalf("sent %+v", sent)
	}

	listed, err := tools["accounting_upward_report_list"].Invoke(ctx, json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	records := listed.([]accounting.UpwardReport)
	if len(records) != 1 || records[0].ID != sent.ID {
		t.Fatalf("listed %+v", records)
	}
}
