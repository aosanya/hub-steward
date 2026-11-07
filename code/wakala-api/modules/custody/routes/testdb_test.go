package routes_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"wakalaserver/modules/shared/dispatch"

	custody "wakalaserver/modules/custody"
	"wakalaserver/modules/custody/routes"
)

const testSpec = "../spec/examples/mwanachama.custody.json"

func callerIs(id string) dispatch.Caller {
	return func(context.Context) string { return id }
}

func newManager(t *testing.T, resolver custody.ScopeResolver) (*custody.CustodyManager, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	s, err := custody.LoadSpec(testSpec)
	if err != nil {
		t.Fatalf("LoadSpec: %v", err)
	}
	if err := custody.Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	cm, err := custody.NewCustodyManager(db, s, custody.SystemClock, resolver)
	if err != nil {
		t.Fatalf("NewCustodyManager: %v", err)
	}
	return cm, db
}

func serve(t *testing.T, cm *custody.CustodyManager, caller string) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	for _, rt := range routes.RoutesFor(cm, routes.Mount{Caller: callerIs(caller)}) {
		mux.Handle(rt.Pattern(""), rt.Handler)
	}
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}
