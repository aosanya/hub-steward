package http

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"testing"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type demoAgency struct {
	name string
	raw  []byte
}

var demoImportDefects = map[string]string{
	"boda-boda-riders": "SW519: the demo imports with unknown control RU-8 and unknown role R-8",
}

func (d demoAgency) skipWhileItsImportIsBroken(t *testing.T) {
	t.Helper()
	if reason, broken := demoImportDefects[d.name]; broken {
		t.Skip(reason)
	}
}

type demoStep struct {
	Code            string                      `json:"code"`
	Title           string                      `json:"title"`
	Prompt          string                      `json:"prompt"`
	Kind            agencymodels.StepKind       `json:"kind"`
	RoleID          string                      `json:"role_id"`
	RecipientRoleID string                      `json:"recipient_role_id"`
	FormName        string                      `json:"form_name"`
	Questions       []agencymodels.StepQuestion `json:"questions"`
}

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

func isFormKind(kind agencymodels.StepKind) bool {
	return kind == agencymodels.StepKindFillForm || kind == agencymodels.StepKindSendForm
}

func demoAgencies(t *testing.T) []demoAgency {
	t.Helper()
	paths, err := filepath.Glob(filepath.Join("..", "..", "..", "..", "..", "demo", "*", "agency.json"))
	if err != nil || len(paths) == 0 {
		t.Fatalf("no demo agency files found: %v", err)
	}
	sort.Strings(paths)
	var found []demoAgency
	for _, path := range paths {
		raw, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		found = append(found, demoAgency{name: filepath.Base(filepath.Dir(path)), raw: raw})
	}
	return found
}

func demoSteps(t *testing.T, raw []byte) []demoStep {
	t.Helper()
	var file struct {
		WorkItems []demoStep `json:"work_items"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatalf("decode work items: %v", err)
	}
	return file.WorkItems
}

func importDemoAgency(t *testing.T, raw []byte) (stepRunWalk, importResult) {
	t.Helper()
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
	return walk, result
}

func withARequiredFieldOnEveryFormStep(t *testing.T, raw []byte) []byte {
	t.Helper()
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("decode the demo agency: %v", err)
	}
	items, _ := doc["work_items"].([]any)
	for _, item := range items {
		questions, _ := item.(map[string]any)["questions"].([]any)
		anyRequired := false
		for _, q := range questions {
			if required, _ := q.(map[string]any)["required"].(bool); required {
				anyRequired = true
			}
		}
		if !anyRequired && len(questions) > 0 {
			questions[0].(map[string]any)["required"] = true
		}
	}
	out, err := json.Marshal(doc)
	if err != nil {
		t.Fatalf("encode the demo agency: %v", err)
	}
	return out
}
