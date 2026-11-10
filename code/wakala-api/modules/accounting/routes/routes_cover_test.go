package routes_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	accounting "wakalaserver/modules/accounting"
	"wakalaserver/modules/accounting/routes"
)

func ledgerOnMemory(t *testing.T) accounting.LedgerRepository {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	s, err := accounting.SpecFor("test")
	if err != nil {
		t.Fatal(err)
	}
	if err := accounting.Provision(db, s); err != nil {
		t.Fatal(err)
	}
	repo, err := accounting.NewLedgerRepository(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return repo
}

func serve(list []routes.Route, method, path, body string) *httptest.ResponseRecorder {
	mux := http.NewServeMux()
	for _, r := range list {
		mux.HandleFunc(r.Pattern(""), r.Handler)
	}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	mux.ServeHTTP(rec, req)
	return rec
}

func patternsOf(list []routes.Route) map[string]bool {
	out := map[string]bool{}
	for _, r := range list {
		out[r.Pattern("")] = true
	}
	return out
}

func TestShapeNamesEveryBuiltRouteAndCarriesNoHandler(t *testing.T) {
	repo := ledgerOnMemory(t)
	built, err := routes.Build(repo)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	shape := routes.Shape()
	if len(shape) == 0 || len(shape) != len(built) {
		t.Fatalf("shape %d, built %d", len(shape), len(built))
	}
	have := patternsOf(built)
	for _, r := range shape {
		if r.Method == "" || r.Path == "" || r.Action == "" || r.Handler != nil {
			t.Fatalf("shape route %+v", r)
		}
		if !have[r.Pattern("")] {
			t.Fatalf("shape names %q but nothing is built for it", r.Pattern(""))
		}
	}
	for i := 1; i < len(shape); i++ {
		if shape[i-1].Action > shape[i].Action && shape[i-1].Path == shape[i].Path {
			t.Fatalf("shape is not in a stable order at %d", i)
		}
	}
}

func TestEveryConstructorBuildsTheSameRoutes(t *testing.T) {
	repo := ledgerOnMemory(t)
	allow := func(context.Context, string) error { return nil }
	want := len(routes.Routes(repo))
	if want == 0 {
		t.Fatal("no routes")
	}
	if got := len(routes.RoutesWith(repo, allow)); got != want {
		t.Fatalf("RoutesWith %d, want %d", got, want)
	}
	if got := len(routes.RoutesFor(repo, routes.Mount{Authorize: allow})); got != want {
		t.Fatalf("RoutesFor %d, want %d", got, want)
	}
	with, err := routes.BuildWith(repo, allow)
	if err != nil || len(with) != want {
		t.Fatalf("BuildWith %d %v", len(with), err)
	}
}

func TestAnAuthorizerThatRefusesStopsTheRouteBeforeTheLedger(t *testing.T) {
	repo := ledgerOnMemory(t)
	var asked []string
	refuse := func(_ context.Context, action string) error {
		asked = append(asked, action)
		return errors.New("no")
	}
	rec := serve(routes.RoutesWith(repo, refuse), http.MethodGet, "/accounts", "")
	if rec.Code != http.StatusForbidden {
		t.Fatalf("refused list answered %d %s", rec.Code, rec.Body.String())
	}
	if len(asked) != 1 || asked[0] != "accounting.account.list" {
		t.Fatalf("asked %v", asked)
	}
	accounts, _ := repo.ListAccounts(context.Background(), 0)
	if len(accounts) != 0 {
		t.Fatalf("accounts %+v", accounts)
	}
}

func TestAnAccountIsOpenedAndReadBackOverHTTP(t *testing.T) {
	repo := ledgerOnMemory(t)
	list := routes.Routes(repo)
	opened := serve(list, http.MethodPost, "/accounts", `{"category":"cash","holder_id":"hub-1","type":"asset","code":"1000"}`)
	if opened.Code != http.StatusCreated {
		t.Fatalf("open answered %d %s", opened.Code, opened.Body.String())
	}
	var account accounting.Account
	if err := json.Unmarshal(opened.Body.Bytes(), &account); err != nil || account.ID == "" || account.Code != "1000" {
		t.Fatalf("account %+v %v", account, err)
	}
	read := serve(list, http.MethodGet, "/accounts/"+account.ID, "")
	if read.Code != http.StatusOK || !strings.Contains(read.Body.String(), account.ID) {
		t.Fatalf("read answered %d %s", read.Code, read.Body.String())
	}
	balance := serve(list, http.MethodGet, "/accounts/"+account.ID+"/balance", "")
	if balance.Code != http.StatusOK {
		t.Fatalf("balance answered %d %s", balance.Code, balance.Body.String())
	}
}

func TestRefusalsMapToTheirStatusCodes(t *testing.T) {
	repo := ledgerOnMemory(t)
	list := routes.Routes(repo)
	if rec := serve(list, http.MethodGet, "/accounts/missing", ""); rec.Code != http.StatusNotFound {
		t.Fatalf("missing account answered %d %s", rec.Code, rec.Body.String())
	}
	if rec := serve(list, http.MethodGet, "/accounts/missing/balance", ""); rec.Code != http.StatusNotFound {
		t.Fatalf("missing balance answered %d %s", rec.Code, rec.Body.String())
	}
	if rec := serve(list, http.MethodPost, "/entries", `{"debit_account_id":"a","credit_account_id":"a","amount":0,"document_kind":"x","document_id":"d","actor_id":"a"}`); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad entry answered %d %s", rec.Code, rec.Body.String())
	}
}

func TestAnEntryPostedOverHTTPShowsInTheAccountsList(t *testing.T) {
	repo := ledgerOnMemory(t)
	ctx := context.Background()
	cash, _ := repo.OpenAccount(ctx, accounting.Account{Category: "cash", HolderID: "h", Type: accounting.AccountTypeAsset})
	sales, _ := repo.OpenAccount(ctx, accounting.Account{Category: "sales", HolderID: "h", Type: accounting.AccountTypeIncome})
	list := routes.Routes(repo)
	body := `{"debit_account_id":"` + cash.ID + `","credit_account_id":"` + sales.ID + `","amount":250,"document_kind":"invoice","document_id":"inv-1","actor_id":"a"}`
	posted := serve(list, http.MethodPost, "/entries", body)
	if posted.Code != http.StatusCreated {
		t.Fatalf("post answered %d %s", posted.Code, posted.Body.String())
	}
	entries := serve(list, http.MethodGet, "/accounts/"+cash.ID+"/entries", "")
	if entries.Code != http.StatusOK || !strings.Contains(entries.Body.String(), "inv-1") {
		t.Fatalf("entries answered %d %s", entries.Code, entries.Body.String())
	}
	if got, _ := repo.Balance(ctx, cash.ID); got != 250 {
		t.Fatalf("balance %d", got)
	}
}
