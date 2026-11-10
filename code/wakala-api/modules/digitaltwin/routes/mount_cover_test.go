package routes_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	digitaltwin "wakalaserver/modules/digitaltwin"
	"wakalaserver/modules/digitaltwin/routes"
)

func TestRoutesAndBuildGiveTheSameTable(t *testing.T) {
	tm, _ := newManager(t)
	built, err := routes.Build(tm)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	listed := routes.Routes(tm)
	forMount := routes.RoutesFor(tm, routes.Mount{})
	if len(built) == 0 || len(listed) != len(built) || len(forMount) != len(built) {
		t.Fatalf("build %d, routes %d, routes for mount %d", len(built), len(listed), len(forMount))
	}
}

func TestSplitLeavesNothingAnonymousAndEveryRouteGated(t *testing.T) {
	tm, _ := newManager(t)
	split := routes.Split(tm, routes.Mount{})
	if len(split.Anonymous) != 0 || len(split.Gated) != len(routes.Routes(tm)) {
		t.Fatalf("anonymous %d, gated %d", len(split.Anonymous), len(split.Gated))
	}
}

func TestToolsAreNamedOnceAndEachCarriesAnActionAndASchema(t *testing.T) {
	tm, _ := newManager(t)
	tools, err := routes.BuildTools(tm, routes.Mount{})
	if err != nil {
		t.Fatalf("BuildTools: %v", err)
	}
	if len(tools) == 0 {
		t.Fatal("no tools")
	}
	seen := map[string]bool{}
	for _, tool := range tools {
		if tool.Name == "" || seen[tool.Name] {
			t.Fatalf("tool name %q is empty or repeated", tool.Name)
		}
		seen[tool.Name] = true
		if !strings.HasPrefix(tool.Action, "digitaltwin.") || len(tool.InputSchema) == 0 || (tool.Invoke == nil && tool.Handle == nil) {
			t.Fatalf("tool %+v is incomplete", tool.Name)
		}
	}
}

func TestARefusedToolCallNeverReachesTheManager(t *testing.T) {
	tm, ctx := newManager(t)
	refuse := func(context.Context, string) error { return errors.New("no") }
	tools, err := routes.BuildTools(tm, routes.Mount{Authorize: refuse})
	if err != nil {
		t.Fatalf("BuildTools: %v", err)
	}
	var create *routes.Tool
	for i := range tools {
		if tools[i].Action == "digitaltwin.node.create" {
			create = &tools[i]
		}
	}
	if create == nil || create.Invoke == nil {
		t.Fatal("no node create tool")
	}
	if _, err := create.Invoke(ctx, []byte(`{"name":"Line 4","kind":"pipeline"}`)); err == nil {
		t.Fatal("a refused call was let through")
	}
	nodes, err := tm.ListNodes(ctx, digitaltwin.NodeFilter{})
	if err != nil || len(nodes) != 0 {
		t.Fatalf("nodes %+v %v", nodes, err)
	}
}
