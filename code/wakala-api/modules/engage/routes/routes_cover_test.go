package routes_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/modules/engage/routes"
)

func serveRoutes(list []routes.Route, method, path, body string) *httptest.ResponseRecorder {
	mux := http.NewServeMux()
	for _, rt := range list {
		mux.HandleFunc(rt.Pattern(""), rt.Handler)
	}
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func TestBuildAndBuildForYieldTheSameRoutesAsRoutesFor(t *testing.T) {
	pm := newManager(t)
	want := len(routes.RoutesFor(pm, routes.Mount{}))
	if want == 0 {
		t.Fatal("no routes declared")
	}
	built, err := routes.Build(pm)
	if err != nil || len(built) != want {
		t.Fatalf("Build = %d routes, %v; want %d", len(built), err, want)
	}
	builtFor, err := routes.BuildFor(pm, routes.Mount{Caller: callerFrom})
	if err != nil || len(builtFor) != want {
		t.Fatalf("BuildFor = %d routes, %v; want %d", len(builtFor), err, want)
	}
}

func TestEveryBuiltRouteCarriesAnEngageAction(t *testing.T) {
	built, err := routes.Build(newManager(t))
	if err != nil {
		t.Fatal(err)
	}
	for _, rt := range built {
		if !strings.HasPrefix(rt.Action, "engage.") {
			t.Errorf("%s %s has action %q", rt.Method, rt.Path, rt.Action)
		}
	}
}

func TestEverySentinelIsAKnownDistinctError(t *testing.T) {
	seen := map[error]string{}
	for name, err := range routes.Sentinels {
		if err == nil {
			t.Errorf("%s is nil", name)
			continue
		}
		if other, dup := seen[err]; dup {
			t.Errorf("%s and %s share one error", name, other)
		}
		seen[err] = name
	}
}

func TestARefusingAuthorizerAnswersForbiddenBeforeAnythingIsPosted(t *testing.T) {
	pm := newManager(t)
	var asked []string
	refuse := func(_ context.Context, action string) error {
		asked = append(asked, action)
		return errors.New("no")
	}
	list, err := routes.BuildFor(pm, routes.Mount{Authorize: refuse, Caller: func(context.Context) string { return "actor-1" }})
	if err != nil {
		t.Fatal(err)
	}
	rec := serveRoutes(list, http.MethodPost, "/posts", `{"kind":"notice","title":"Water off","group_ids":["g-1"]}`)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("refused create answered %d %s", rec.Code, rec.Body.String())
	}
	if len(asked) != 1 || asked[0] != "engage.post.create" {
		t.Fatalf("authorizer asked %v", asked)
	}
	open := serveRoutes(routes.RoutesFor(pm, routes.Mount{Caller: func(context.Context) string { return "actor-1" }}), http.MethodGet, "/posts/nope", "")
	if open.Code != http.StatusNotFound {
		t.Fatalf("unknown post answered %d", open.Code)
	}
}

func TestAnAllowingAuthorizerLetsTheCallThrough(t *testing.T) {
	var asked []string
	allow := func(_ context.Context, action string) error {
		asked = append(asked, action)
		return nil
	}
	list := routes.RoutesFor(newManager(t), routes.Mount{Authorize: allow, Caller: func(context.Context) string { return "actor-1" }})
	rec := serveRoutes(list, http.MethodPost, "/posts", `{"kind":"notice","title":"Water off","group_ids":["g-1"]}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("allowed create answered %d %s", rec.Code, rec.Body.String())
	}
	if len(asked) != 1 || asked[0] != "engage.post.create" {
		t.Fatalf("authorizer asked %v", asked)
	}
}
