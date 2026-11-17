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

func patterns(rs []routes.Route) map[string]bool {
	out := map[string]bool{}
	for _, rt := range rs {
		out[rt.Pattern("")] = true
	}
	return out
}

func TestBuildBuildForAndRoutesForDeclareTheSameAddresses(t *testing.T) {
	pm := newManager(t)
	built, err := routes.Build(pm)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	forMount, err := routes.BuildFor(pm, routes.Mount{Caller: callerFrom})
	if err != nil {
		t.Fatalf("BuildFor: %v", err)
	}
	listed := routes.RoutesFor(pm, routes.Mount{})
	if len(built) == 0 || len(forMount) != len(built) || len(listed) != len(built) {
		t.Fatalf("build %d, build for %d, routes for %d", len(built), len(forMount), len(listed))
	}
	want := patterns(built)
	for pattern := range patterns(forMount) {
		if !want[pattern] {
			t.Fatalf("BuildFor declared %q that Build did not", pattern)
		}
	}
}

func TestEverySplitRouteIsGatedWhenNothingIsAnonymous(t *testing.T) {
	pm := newManager(t)
	split := routes.Split(pm, routes.Mount{})
	if len(split.Gated) != len(routes.RoutesFor(pm, routes.Mount{})) {
		t.Fatalf("gated %d of %d routes", len(split.Gated), len(routes.RoutesFor(pm, routes.Mount{})))
	}
}

func TestARefusedActionAnswers403AndNamesAnEngageAction(t *testing.T) {
	pm := newManager(t)
	var asked []string
	refuse := func(_ context.Context, action string) error {
		asked = append(asked, action)
		return errors.New("no")
	}
	mux := http.NewServeMux()
	for _, rt := range routes.RoutesFor(pm, routes.Mount{Caller: callerFrom, Authorize: refuse}) {
		mux.HandleFunc(rt.Pattern(""), rt.Handler)
	}
	for _, rt := range routes.RoutesFor(pm, routes.Mount{}) {
		if !strings.HasPrefix(rt.Pattern(""), "GET ") || strings.Contains(rt.Pattern(""), "{") {
			continue
		}
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, strings.TrimPrefix(rt.Pattern(""), "GET "), nil))
		if rec.Code != http.StatusForbidden {
			t.Fatalf("%s answered %d %s", rt.Pattern(""), rec.Code, rec.Body.String())
		}
		if len(asked) == 0 || !strings.HasPrefix(asked[len(asked)-1], "engage.") {
			t.Fatalf("asked %v", asked)
		}
		return
	}
	t.Skip("no parameterless GET address declared")
}
