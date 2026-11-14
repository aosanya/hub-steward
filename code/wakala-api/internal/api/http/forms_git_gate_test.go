package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type formsGitGate struct {
	walk stepRunWalk
}

func newFormsGitGate(t *testing.T) formsGitGate {
	t.Helper()
	return formsGitGate{walk: newStepRunWalk(t, nil)}
}

func (g formsGitGate) repositoryRoute() string {
	return "/instances/" + g.walk.instance + "/forms-git/repos"
}

func (g formsGitGate) get(t *testing.T, path string) (int, string) {
	t.Helper()
	rec := g.walk.call(t, "GET", path, nil, g.walk.owner)
	return rec.Code, rec.Body.String()
}

func (g formsGitGate) listRepositoriesTool(t *testing.T) string {
	t.Helper()
	tools, err := formsGitTools(formsGitShape{})
	if err != nil {
		t.Fatal(err)
	}
	for _, tool := range tools {
		if strings.HasSuffix(tool.Name, "repository_list") {
			return tool.Name
		}
	}
	t.Fatal("the forms git mount declares no repository list tool")
	return ""
}

func (g formsGitGate) callTool(t *testing.T, name string) error {
	t.Helper()
	ctx := accounts.WithID(context.Background(), "test-owner")
	raw, err := json.Marshal(map[string]any{"instance_id": g.walk.instance})
	if err != nil {
		t.Fatal(err)
	}
	_, err = g.walk.deps.invokeFormsGitTool(ctx, name, raw)
	return err
}

func (g formsGitGate) rows(t *testing.T, path string) []map[string]any {
	t.Helper()
	code, body := g.get(t, path)
	if code != http.StatusOK {
		t.Fatalf("GET %s: %d %s", path, code, body)
	}
	var rows []map[string]any
	if err := json.Unmarshal([]byte(body), &rows); err != nil {
		t.Fatalf("GET %s body %q: %v", path, body, err)
	}
	return rows
}

func (g formsGitGate) create(t *testing.T, path string, body map[string]any) map[string]any {
	t.Helper()
	rec := g.walk.call(t, "POST", path, body, g.walk.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST %s: %d %s", path, rec.Code, rec.Body.String())
	}
	return decodeObject(t, rec)
}

func (g formsGitGate) publishWithModules(t *testing.T, codes ...string) {
	t.Helper()
	base := "/instances/" + g.walk.instance
	drafts := g.rows(t, base+"/drafts")
	if len(drafts) == 0 {
		t.Fatalf("instance %s has no draft to publish", g.walk.instance)
	}
	draftID, _ := drafts[0]["id"].(string)
	goal := g.create(t, base+"/goals", map[string]any{"draft_id": draftID, "title": "Serve the members"})
	g.create(t, base+"/objectives", map[string]any{"draft_id": draftID, "goal_id": goal["id"], "title": "Run the modules in use"})
	g.create(t, base+"/roles", map[string]any{"draft_id": draftID, "name": "Coordinator"})
	moduleIDs := map[string]string{}
	for _, m := range g.rows(t, base+"/modules?draft_id="+draftID) {
		code, _ := m["code"].(string)
		id, _ := m["id"].(string)
		moduleIDs[code] = id
	}
	for _, code := range codes {
		id, ok := moduleIDs[code]
		if !ok {
			t.Fatalf("draft %s carries no module %q; has %v", draftID, code, moduleIDs)
		}
		rec := g.walk.call(t, "PUT", base+"/modules/"+id+"/enabled", map[string]any{"draft_id": draftID, "enabled": true}, g.walk.owner)
		if rec.Code != http.StatusOK {
			t.Fatalf("PUT module %s enabled: %d %s", code, rec.Code, rec.Body.String())
		}
	}
	g.create(t, base+"/publications", map[string]any{"draft_id": draftID, "tag": fmt.Sprintf("modules-%d", len(drafts)), "channel": "production"})
}

func TestFormsGit_AnAgencyWithOnlyGitMountedReachesTheRoutesAndTools(t *testing.T) {
	g := newFormsGitGate(t)
	runsModules(t, g.walk.instance, "git")
	if code, body := g.get(t, g.repositoryRoute()); code != http.StatusOK {
		t.Fatalf("GET %s with only git mounted = %d %s, want 200", g.repositoryRoute(), code, body)
	}
	if err := g.callTool(t, g.listRepositoriesTool(t)); err != nil {
		t.Fatalf("the repository list tool with only git mounted: %v", err)
	}
}

func TestFormsGit_AnAgencyWithoutGitMountedIsRefusedTheRoutesAndTools(t *testing.T) {
	g := newFormsGitGate(t)
	runsModules(t, g.walk.instance, "forms", "comm")
	if code, body := g.get(t, g.repositoryRoute()); code != http.StatusNotFound {
		t.Fatalf("GET %s with git off = %d %s, want 404", g.repositoryRoute(), code, body)
	}
	if err := g.callTool(t, g.listRepositoriesTool(t)); !errors.Is(err, agencies.ErrInstanceNotFound) {
		t.Fatalf("the repository list tool with git off = %v, want ErrInstanceNotFound", err)
	}
}

func TestFormsGit_AnAgencyThatPublishesFormsStillReachesGitBecauseFormsRequiresIt(t *testing.T) {
	g := newFormsGitGate(t)
	g.publishWithModules(t, "forms")
	if code, body := g.get(t, g.repositoryRoute()); code != http.StatusOK {
		t.Fatalf("GET %s after publishing forms = %d %s, want 200", g.repositoryRoute(), code, body)
	}
}

func TestFormsGit_AnAgencyThatPublishesWithoutFormsOrGitIsRefused(t *testing.T) {
	g := newFormsGitGate(t)
	g.publishWithModules(t, "comm")
	if code, body := g.get(t, g.repositoryRoute()); code != http.StatusNotFound {
		t.Fatalf("GET %s after publishing comm only = %d %s, want 404", g.repositoryRoute(), code, body)
	}
}
