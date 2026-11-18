package routes

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	workspace "wakalaserver/modules/workspace"
)

func actionsOf(rs []Route) map[string]bool {
	out := map[string]bool{}
	for _, r := range rs {
		out[r.Action] = true
	}
	return out
}

func TestOnlyTheOpenActionIsPublicAndNoOwnerRouteIsAnonymous(t *testing.T) {
	var manager workspace.WorkspaceManager = &workbookOwners{}
	public := actionsOf(PublicRoutes(manager))
	if len(public) != 1 || !public["workspace.workbook.open"] {
		t.Fatalf("public actions = %v; want only workspace.workbook.open", public)
	}
	owner := actionsOf(OwnerRoutes(manager))
	if owner["workspace.workbook.open"] {
		t.Errorf("open is anonymous yet also listed among the gated owner routes")
	}
	if len(owner) == 0 {
		t.Fatalf("no gated owner routes")
	}
}

func TestSplitAndSplitWithAgreeWithTheOwnerRoutes(t *testing.T) {
	var manager workspace.WorkspaceManager = &workbookOwners{}
	refuse := func(context.Context, string) error { return errors.New("no") }
	for name, split := range map[string][]Route{"Split": Split(manager).Gated, "SplitWith": SplitWith(manager, refuse).Gated, "OwnerRoutesWith": OwnerRoutesWith(manager, refuse)} {
		got := actionsOf(split)
		want := actionsOf(OwnerRoutes(manager))
		if len(got) != len(want) {
			t.Errorf("%s gated %d actions; want %d", name, len(got), len(want))
		}
	}
}

func TestARefusingAuthorizerAnswers403AndIsAskedForTheDeclaredAction(t *testing.T) {
	var manager workspace.WorkspaceManager = &workbookOwners{}
	var asked []string
	refuse := func(_ context.Context, action string) error {
		asked = append(asked, action)
		return errors.New("no")
	}
	mux := http.NewServeMux()
	for _, r := range RoutesWith(manager, refuse) {
		mux.HandleFunc(r.Pattern(""), r.Handler)
	}
	checked := 0
	for _, r := range RoutesFor(manager, Mount{}) {
		pattern := r.Pattern("")
		if !strings.HasPrefix(pattern, "GET ") || strings.Contains(pattern, "{") {
			continue
		}
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, strings.TrimPrefix(pattern, "GET "), nil))
		if rec.Code != http.StatusForbidden {
			t.Fatalf("%s answered %d; want 403", pattern, rec.Code)
		}
		checked++
	}
	if checked == 0 || len(asked) != checked {
		t.Fatalf("checked %d routes, authorizer asked %d times", checked, len(asked))
	}
	for _, a := range asked {
		if !strings.HasPrefix(a, "workspace.") {
			t.Errorf("authorizer asked for %q; want a workspace action", a)
		}
	}
}

func TestToolsLeaveOutTheAnonymousActionAndKeepEveryOtherOne(t *testing.T) {
	var manager workspace.WorkspaceManager = &workbookOwners{}
	tools, err := BuildTools(manager)
	if err != nil {
		t.Fatalf("BuildTools: %v", err)
	}
	if len(tools) != len(OwnerRoutes(manager)) {
		t.Errorf("%d tools for %d owner routes", len(tools), len(OwnerRoutes(manager)))
	}
	for _, tool := range tools {
		if tool.Action == "workspace.workbook.open" {
			t.Errorf("anonymous action %s is served as a tool", tool.Action)
		}
	}
	if len(Tools(manager)) != len(tools) || len(ToolsWith(manager, nil)) != len(tools) {
		t.Errorf("Tools and ToolsWith disagree with BuildTools")
	}
}

func TestLayoutRoutesAndToolsAreBuiltWithEveryAddressGated(t *testing.T) {
	var layouts workspace.LayoutManager = &layoutStub{}
	built, err := BuildLayoutRoutes(layouts, nil)
	if err != nil || len(built) == 0 {
		t.Fatalf("BuildLayoutRoutes: %d routes, %v", len(built), err)
	}
	if len(LayoutRoutes(layouts)) != len(built) || len(LayoutRoutesWith(layouts, nil)) != len(built) {
		t.Errorf("layout route builders disagree")
	}
	tools, err := BuildLayoutTools(layouts, nil)
	if err != nil || len(tools) == 0 {
		t.Fatalf("BuildLayoutTools: %d tools, %v", len(tools), err)
	}
	if len(LayoutTools(layouts)) != len(tools) || len(LayoutToolsWith(layouts, nil)) != len(tools) {
		t.Errorf("layout tool builders disagree")
	}
}

func TestEveryDeclaredErrorNameHasASentinel(t *testing.T) {
	for name, err := range sentinels {
		if err == nil {
			t.Errorf("sentinel %s is nil", name)
		}
	}
	for name, err := range layoutSentinels {
		if err == nil {
			t.Errorf("layout sentinel %s is nil", name)
		}
	}
}

type layoutStub struct{ workspace.LayoutManager }
