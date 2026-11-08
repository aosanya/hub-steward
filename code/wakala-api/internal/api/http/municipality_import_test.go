package http

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
)

type municipalityFile struct {
	Workflows []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"workflows"`
	WorkItems []struct {
		WorkflowID string `json:"workflow_id"`
	} `json:"work_items"`
}

func TestTheMunicipalityAgencyImportsEveryStepOfEveryWorkflow(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "..", "demo", "municipality.json"))
	if err != nil {
		t.Fatalf("read demo/municipality.json: %v", err)
	}
	var file municipalityFile
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatalf("decode demo/municipality.json: %v", err)
	}
	want := map[string]int{}
	nameOf := map[string]string{}
	for _, workflow := range file.Workflows {
		nameOf[workflow.ID] = workflow.Name
	}
	for _, item := range file.WorkItems {
		want[nameOf[item.WorkflowID]]++
	}

	walk := newStepRunWalk(t, nil)
	rec := walk.call(t, "POST", "/instances/import", json.RawMessage(raw), walk.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode import result: %v", err)
	}
	if len(result.Errors) > 0 {
		t.Fatalf("the import reported %d errors: %q", len(result.Errors), result.Errors)
	}
	if result.Created["work_items"] != len(file.WorkItems) {
		t.Fatalf("created %d work items, the file holds %d", result.Created["work_items"], len(file.WorkItems))
	}

	ctx := context.Background()
	mgr, err := walk.deps.Registry.AgencyManager(ctx, result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	workflows, err := mgr.ListWorkflows(ctx, result.DraftID, mwanachamaagency.WorkflowFilter{})
	if err != nil {
		t.Fatalf("ListWorkflows: %v", err)
	}
	steps, err := mgr.ListWorkItems(ctx, result.DraftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		t.Fatalf("ListWorkItems: %v", err)
	}
	got := map[string]int{}
	byID := map[string]string{}
	for _, workflow := range workflows {
		byID[workflow.ID] = workflow.Name
	}
	for _, step := range steps {
		got[byID[step.WorkflowID]]++
	}
	for name, count := range want {
		if got[name] != count {
			t.Errorf("workflow %q imported %d steps, the file holds %d", name, got[name], count)
		}
	}
	if len(got) != len(want) {
		t.Errorf("imported %d workflows with steps, the file holds %d", len(got), len(want))
	}
}
