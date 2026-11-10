package routes_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	ai "wakalaserver/modules/ai"
	"wakalaserver/modules/ai/models"
	"wakalaserver/modules/ai/routes"
)

const usageAgency = "agency-1"

func usageServer(t *testing.T, caller string) (*httptest.Server, ai.Manager) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := ai.SpecFor("usage")
	if err != nil {
		t.Fatal(err)
	}
	if err := ai.Provision(db, s); err != nil {
		t.Fatal(err)
	}
	m, err := ai.NewManager(db, s, ai.WithMasterKey([]byte("0123456789abcdef0123456789abcdef")))
	if err != nil {
		t.Fatal(err)
	}
	table, err := routes.BuildFor(m, routes.Mount{Caller: func(context.Context) string { return caller }})
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	for _, r := range table {
		mux.HandleFunc(r.Pattern(""), r.Handler)
	}
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server, m
}

func readMine(t *testing.T, server *httptest.Server, query string) (int, ai.AssistantUsage) {
	t.Helper()
	res, err := http.Get(server.URL + "/agencies/" + usageAgency + "/assistant-usage/mine" + query)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var got ai.AssistantUsage
	_ = json.NewDecoder(res.Body).Decode(&got)
	return res.StatusCode, got
}

func spend(t *testing.T, m ai.Manager, person string, tokens int) {
	t.Helper()
	ctx := context.Background()
	accounts, err := m.ListAccounts(ctx, usageAgency)
	if err != nil {
		t.Fatal(err)
	}
	var account ai.Account
	if len(accounts) > 0 {
		account = accounts[0]
	} else if account, err = m.CreateAccount(ctx, usageAgency, ai.Account{Name: "a", Provider: models.ProviderOpenAICompatible, BaseURL: "http://127.0.0.1:1", ModelName: "m", Status: models.StatusEnabled, ChatEnabled: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := m.RecordUsage(ctx, usageAgency, ai.UsageInput{AccountID: account.ID, TokensIn: tokens, Kind: models.KindChat, Person: person}); err != nil {
		t.Fatal(err)
	}
}

func TestTheRouteAnswersWithTheCallersOwnCountAndNobodyElses(t *testing.T) {
	server, m := usageServer(t, "ana")
	spend(t, m, "ana", 40)
	spend(t, m, "ben", 900)
	status, got := readMine(t, server, "")
	if status != http.StatusOK || got.DayTokens != 40 || got.MonthTokens != 40 {
		t.Fatalf("status %d, usage %+v, want ana's 40 and none of ben's 900", status, got)
	}
}

func TestAPersonNamedInTheRequestIsIgnored(t *testing.T) {
	server, m := usageServer(t, "ana")
	spend(t, m, "ana", 40)
	spend(t, m, "ben", 900)
	status, got := readMine(t, server, "?person_id=ben&person=ben")
	if status != http.StatusOK || got.DayTokens != 40 {
		t.Fatalf("status %d, usage %+v, want ana's count whoever the request names", status, got)
	}
}

func TestACallWithNoCallerPersonIsRefused(t *testing.T) {
	server, m := usageServer(t, "")
	spend(t, m, "ben", 900)
	status, got := readMine(t, server, "")
	if status == http.StatusOK || got.DayTokens != 0 {
		t.Fatalf("status %d, usage %+v, want a refusal that shows no count", status, got)
	}
}
