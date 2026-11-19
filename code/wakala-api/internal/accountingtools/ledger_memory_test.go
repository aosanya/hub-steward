package accountingtools_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	accounting "github.com/aosanya/mwanachama-backend-accounting"
	accountingroutes "github.com/aosanya/mwanachama-backend-accounting/routes"
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

func serve(list []accountingroutes.Route, method, path, body string) *httptest.ResponseRecorder {
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
