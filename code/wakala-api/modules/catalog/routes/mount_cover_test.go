package routes

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/dispatch"
)

type openedEntries struct {
	catalog.CatalogManager
	slugs []string
	err   error
}

func (o *openedEntries) OpenEntry(_ context.Context, slug, _ string) (catalog.Entry, error) {
	o.slugs = append(o.slugs, slug)
	return catalog.Entry{}, o.err
}

func actionsOf(rs []Route) []string {
	out := make([]string, 0, len(rs))
	for _, r := range rs {
		out = append(out, r.Action)
	}
	sort.Strings(out)
	return out
}

func denyEverything(context.Context, string) error { return dispatch.ErrForbidden }

func findAction(t *testing.T, rs []Route, action string) Route {
	t.Helper()
	for _, r := range rs {
		if r.Action == action {
			return r
		}
	}
	t.Fatalf("no route for %s", action)
	return Route{}
}

func TestSplitOpensExactlyTheAnonymousActionsAndGatesTheRest(t *testing.T) {
	split := Split(&openedEntries{})
	if got, want := actionsOf(split.Anonymous), append([]string(nil), AnonymousActions...); strings.Join(got, ",") != strings.Join(sortedCopy(want), ",") {
		t.Fatalf("anonymous routes = %v, want %v", got, sortedCopy(want))
	}
	for _, r := range split.Gated {
		for _, open := range AnonymousActions {
			if r.Action == open {
				t.Errorf("%s is both gated and anonymous", open)
			}
		}
	}
	if total := len(split.Anonymous) + len(split.Gated); total != len(Routes(&openedEntries{})) {
		t.Errorf("split holds %d routes, the table has %d", total, len(Routes(&openedEntries{})))
	}
}

func sortedCopy(in []string) []string {
	out := append([]string(nil), in...)
	sort.Strings(out)
	return out
}

func TestOperatorRoutesAreTheGatedHalfAndPublicRoutesTheAnonymousHalf(t *testing.T) {
	manager := &openedEntries{}
	if got, want := actionsOf(OperatorRoutes(manager)), actionsOf(Split(manager).Gated); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("operator routes = %v, want the gated half %v", got, want)
	}
	if got, want := actionsOf(PublicRoutes(manager)), sortedCopy(AnonymousActions); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("public routes = %v, want %v", got, want)
	}
}

func TestAMountNamingAnUnknownAnonymousActionIsRefusedAtBuild(t *testing.T) {
	defer func() {
		r := recover()
		if r == nil {
			t.Fatal("a mount opening an action that does not exist to anonymous callers built without complaint")
		}
		if !strings.Contains(r.(string), "catalog.nothing.here") {
			t.Errorf("panic = %v, want it to name the unknown action", r)
		}
	}()
	SplitFor(&openedEntries{}, Mount{Anonymous: []string{"catalog.nothing.here"}})
}

func TestAMountCanNarrowTheAnonymousActionsToNone(t *testing.T) {
	split := SplitFor(&openedEntries{}, Mount{Anonymous: []string{}})
	if len(split.Anonymous) != 0 {
		t.Errorf("anonymous = %v, want none when the mount names an empty list", actionsOf(split.Anonymous))
	}
}

func TestADeniedCallerNeverReachesTheManagerOnAGatedRoute(t *testing.T) {
	manager := &openedEntries{}
	routes := RoutesWith(manager, denyEverything)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/entries/home", nil)
	req.SetPathValue("slug", "home")
	findAction(t, routes, "catalog.entry.open").Handler(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
	if len(manager.slugs) != 0 {
		t.Errorf("manager was reached for %v despite the refusal", manager.slugs)
	}
}

func TestAnonymousOpenIsNotAskedOfTheAuthorizer(t *testing.T) {
	manager := &openedEntries{}
	split := SplitWith(manager, denyEverything)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/entries/home", nil)
	req.SetPathValue("slug", "home")
	findAction(t, split.Anonymous, "catalog.entry.open").Handler(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200 for a public open under a deny-all authorizer", rec.Code)
	}
	if len(manager.slugs) != 1 || manager.slugs[0] != "home" {
		t.Errorf("manager opened %v, want [home]", manager.slugs)
	}
}

func TestGatedHalfOfASplitRefusesWhenTheAuthorizerSaysNo(t *testing.T) {
	split := SplitWith(&openedEntries{}, denyEverything)
	if len(split.Gated) == 0 {
		t.Fatal("no gated routes")
	}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(split.Gated[0].Method, "/", strings.NewReader("{}"))
	split.Gated[0].Handler(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("%s answered %d, want 403", split.Gated[0].Action, rec.Code)
	}
}

func TestAnUnknownEntryOpensAs404(t *testing.T) {
	manager := &openedEntries{err: catalog.ErrEntryNotFound}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/entries/ghost", nil)
	req.SetPathValue("slug", "ghost")
	findAction(t, Routes(manager), "catalog.entry.open").Handler(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestAWrappedSentinelIsStillMappedToItsStatus(t *testing.T) {
	manager := &openedEntries{err: errors.Join(errors.New("context"), catalog.ErrEntryNotFound)}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/entries/ghost", nil)
	req.SetPathValue("slug", "ghost")
	findAction(t, Routes(manager), "catalog.entry.open").Handler(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestEveryDeclaredSentinelNameResolvesToADistinctError(t *testing.T) {
	seen := map[error]string{}
	for name, err := range sentinels {
		if err == nil {
			t.Errorf("%s maps to a nil error", name)
			continue
		}
		if other, dup := seen[err]; dup {
			t.Errorf("%s and %s share one error", name, other)
		}
		seen[err] = name
	}
}

func TestToolsLeaveOutTheAnonymousActionsAndKeepTheRest(t *testing.T) {
	tools, err := BuildTools(&openedEntries{})
	if err != nil {
		t.Fatal(err)
	}
	if len(tools) == 0 {
		t.Fatal("no tools")
	}
	for _, tool := range tools {
		for _, open := range AnonymousActions {
			if tool.Action == open {
				t.Errorf("tool %s exposes the public action %s", tool.Name, open)
			}
		}
	}
	routes, err := Build(&openedEntries{})
	if err != nil {
		t.Fatal(err)
	}
	if want := len(routes) - len(AnonymousActions); len(tools) != want {
		t.Errorf("%d tools, want %d (every route but the anonymous ones)", len(tools), want)
	}
}

func TestToolsWithADenyingAuthorizerRefuseToRun(t *testing.T) {
	manager := &openedEntries{}
	ran := 0
	for _, tool := range ToolsWith(manager, denyEverything) {
		ran++
		if _, err := tool.Handle(context.Background(), dispatch.Request{Arguments: []byte("{}")}); err == nil {
			t.Errorf("%s ran under a deny-all authorizer", tool.Name)
		}
	}
	if ran == 0 {
		t.Fatal("no tools to check")
	}
}
