package http

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

func importAndPublishGitMountedAgency(t *testing.T) (stepRunWalk, string) {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("testdata", "git_mounted_agency.json"))
	if err != nil {
		t.Fatalf("read the git mounted agency fixture: %v", err)
	}
	w := newStepRunWalk(t, nil)
	rec := w.call(t, "POST", "/instances/import", json.RawMessage(raw), w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode import result: %v", err)
	}
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	if _, err := mgr.PublishAgency(ctx, result.DraftID, "", ""); err != nil {
		t.Fatalf("PublishAgency: %v", err)
	}
	agencyMountedSets.forget(result.Instance.ID)
	return w, result.Instance.ID
}

func TestAPublishedImportedGitMountedAgencyListsGitAmongItsMounts(t *testing.T) {
	w, instance := importAndPublishGitMountedAgency(t)

	view, err := w.deps.agencyMounts(asPerson("test-owner"), w.deps.Registry, instance)
	if err != nil {
		t.Fatalf("the owner lists the mounts: %v", err)
	}
	listed := map[string]bool{}
	for _, module := range view.Modules {
		listed[module.Module] = true
	}
	for _, want := range []string{"comm", "taskmanager", "git"} {
		if !listed[want] {
			t.Errorf("the published agency lists no %s mount, listed %v", want, view.Modules)
		}
	}
}

func TestAPublishedImportedGitMountedAgencyServesTheGitToolsThroughTheModuleToolsRoute(t *testing.T) {
	w, instance := importAndPublishGitMountedAgency(t)

	tools := moduleToolsOf(t, w, "/instances/"+instance+"/module-tools")

	served := map[string]bool{}
	for _, tool := range tools {
		served[tool.Name] = true
	}
	for _, want := range []string{"forms_git_repository_init", "forms_git_repository_list"} {
		if !served[want] {
			t.Errorf("the published agency serves no %s", want)
		}
	}
}
