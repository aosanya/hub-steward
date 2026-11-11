package http

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
)

type codedFile struct {
	Roles      []codedName `json:"roles"`
	Goals      []codedName `json:"goals"`
	Objectives []codedName `json:"objectives"`
	Workflows  []codedName `json:"workflows"`
	WorkItems  []codedName `json:"work_items"`
	Values     []codedName `json:"values"`
	Rules      []codedName `json:"rules"`
}

type codedName struct {
	Code  string `json:"code"`
	Name  string `json:"name"`
	Title string `json:"title"`
	Text  string `json:"text"`
}

func (c codedName) label() string {
	return firstNonEmpty(c.Name, c.Title, c.Text)
}

var textCodePattern = regexp.MustCompile(`\b(?:RU|V|W|WI|R|C|G|O|RC|RK)(?:-[A-Z]+)?-\d+\b`)

func importMunicipality(t *testing.T) (codedFile, stepRunWalk, importResult) {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "..", "demo", "municipality.json"))
	if err != nil {
		t.Fatalf("read demo/municipality.json: %v", err)
	}
	var file codedFile
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatalf("decode demo/municipality.json: %v", err)
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
	return file, walk, result
}

func TestAnImportedAgencyKeepsTheCodesItsFileGives(t *testing.T) {
	file, walk, result := importMunicipality(t)
	ctx := context.Background()
	mgr, err := walk.deps.Registry.AgencyManager(ctx, result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	live := map[string]string{}
	workflows, err := mgr.ListWorkflows(ctx, result.DraftID, mwanachamaagency.WorkflowFilter{})
	if err != nil {
		t.Fatalf("ListWorkflows: %v", err)
	}
	for _, w := range workflows {
		live[w.Code] = w.Name
	}
	for _, w := range file.Workflows {
		if live[w.Code] != w.Name {
			t.Errorf("workflow %q is %q after import, the file gives it %q", w.Code, live[w.Code], w.Name)
		}
	}
	controls, err := mgr.ListControls(ctx, result.DraftID, mwanachamaagency.ControlFilter{})
	if err != nil {
		t.Fatalf("ListControls: %v", err)
	}
	controlCodes := map[string]bool{}
	for _, c := range controls {
		controlCodes[c.Code] = true
	}
	for _, c := range append(append([]codedName(nil), file.Values...), file.Rules...) {
		if !controlCodes[c.Code] {
			t.Errorf("control %q is missing after import", c.Code)
		}
	}
}

func TestNoTextOfAnImportedAgencyNamesACodeThatDoesNotExist(t *testing.T) {
	_, walk, result := importMunicipality(t)
	ctx := context.Background()
	mgr, err := walk.deps.Registry.AgencyManager(ctx, result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	held := map[string]bool{}
	var texts []string
	roles, _ := mgr.ListRoles(ctx, result.DraftID, mwanachamaagency.RoleFilter{})
	for _, r := range roles {
		held[r.Code] = true
		texts = append(texts, r.Description)
	}
	goals, _ := mgr.ListGoals(ctx, result.DraftID, mwanachamaagency.GoalFilter{})
	for _, g := range goals {
		held[g.Code] = true
		texts = append(texts, g.Description)
	}
	objectives, _ := mgr.ListObjectives(ctx, result.DraftID, mwanachamaagency.ObjectiveFilter{})
	for _, o := range objectives {
		held[o.Code] = true
		texts = append(texts, o.Description)
	}
	workflows, _ := mgr.ListWorkflows(ctx, result.DraftID, mwanachamaagency.WorkflowFilter{})
	for _, w := range workflows {
		held[w.Code] = true
		texts = append(texts, w.Description)
	}
	steps, _ := mgr.ListWorkItems(ctx, result.DraftID, mwanachamaagency.WorkItemFilter{})
	for _, s := range steps {
		held[s.Code] = true
		texts = append(texts, s.Description, s.Prompt)
	}
	controls, _ := mgr.ListControls(ctx, result.DraftID, mwanachamaagency.ControlFilter{})
	for _, c := range controls {
		held[c.Code] = true
		texts = append(texts, c.Text)
	}
	for _, text := range texts {
		for _, code := range textCodePattern.FindAllString(text, -1) {
			if !held[code] {
				t.Errorf("a text names %q, which no row of the imported agency carries", code)
			}
		}
	}
}
