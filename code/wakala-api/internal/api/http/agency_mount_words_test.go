package http

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func importAndPublishWithActorMount(t *testing.T, actorMount string) (stepRunWalk, string) {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("testdata", "git_mounted_agency.json"))
	if err != nil {
		t.Fatalf("read the mounted agency fixture: %v", err)
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("decode the fixture: %v", err)
	}
	actor := map[string]any{"id": "7b2f6c1e-3a4d-4e58-9f10-5d6a8c2b4e90", "code": "actor", "enabled": true}
	if actorMount != "" {
		actor["mounts"] = json.RawMessage(actorMount)
	}
	doc["modules"] = append(doc["modules"].([]any), actor)
	body, err := json.Marshal(doc)
	if err != nil {
		t.Fatalf("encode the agency: %v", err)
	}
	w := newStepRunWalk(t, nil)
	rec := w.call(t, "POST", "/instances/import", json.RawMessage(body), w.owner)
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

func listedActorMountJSON(t *testing.T, w stepRunWalk, instance string) string {
	t.Helper()
	view, err := w.deps.agencyMounts(asPerson("test-owner"), w.deps.Registry, instance)
	if err != nil {
		t.Fatalf("the owner lists the mounts: %v", err)
	}
	for _, module := range view.Modules {
		if module.Module == "actor" {
			raw, err := json.Marshal(module.Mounts)
			if err != nil {
				t.Fatalf("encode the actor mounts: %v", err)
			}
			return string(raw)
		}
	}
	t.Fatalf("no actor mount listed, listed %v", view.Modules)
	return ""
}

func TestAnImportedAgencyListsTheWordsOfAMount(t *testing.T) {
	w, instance := importAndPublishWithActorMount(t, `[{"name":"Residents","key":"directory","words":{"People":"Residents","Person":"Resident"}}]`)

	view, err := w.deps.agencyMounts(asPerson("test-owner"), w.deps.Registry, instance)
	if err != nil {
		t.Fatalf("the owner lists the mounts: %v", err)
	}
	for _, module := range view.Modules {
		if module.Module != "actor" {
			continue
		}
		if len(module.Mounts) != 1 || module.Mounts[0].Name != "Residents" {
			t.Fatalf("actor mounts = %+v", module.Mounts)
		}
		words := module.Mounts[0].Words
		if len(words) != 2 || words["People"] != "Residents" || words["Person"] != "Resident" {
			t.Errorf("actor mount words = %v", words)
		}
		return
	}
	t.Fatalf("no actor mount listed, listed %v", view.Modules)
}

func TestAnImportedAgencyWithoutWordsListsNoWordsKey(t *testing.T) {
	w, instance := importAndPublishWithActorMount(t, `[{"name":"Residents","key":"directory"}]`)

	if got := listedActorMountJSON(t, w, instance); strings.Contains(got, "words") {
		t.Errorf("a mount without words lists a words key: %s", got)
	}
}

func TestAnImportedAgencyRefusesAMountWithABlankWord(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("testdata", "git_mounted_agency.json"))
	if err != nil {
		t.Fatalf("read the mounted agency fixture: %v", err)
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("decode the fixture: %v", err)
	}
	doc["modules"] = append(doc["modules"].([]any), map[string]any{
		"id": "7b2f6c1e-3a4d-4e58-9f10-5d6a8c2b4e90", "code": "actor", "enabled": true,
		"mounts": json.RawMessage(`[{"name":"Residents","key":"directory","words":{"People":" "}}]`),
	})
	body, err := json.Marshal(doc)
	if err != nil {
		t.Fatalf("encode the agency: %v", err)
	}
	w := newStepRunWalk(t, nil)

	rec := w.call(t, "POST", "/instances/import", json.RawMessage(body), w.owner)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("import with a blank word: %d %s", rec.Code, rec.Body.String())
	}
}
