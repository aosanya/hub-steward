package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	"github.com/aosanya/mwanachama-backend-agency/models"
)

func recordCodedFile(t *testing.T, code string) map[string]any {
	t.Helper()
	text := `{
  "name": "Record code agency",
  "roles": [
    {"id": "role-worker", "code": "R-1", "name": "Worker"}
  ],
  "goals": [{"id": "goal-1", "code": "G-1", "title": "Every day is counted"}],
  "objectives": [{"id": "obj-1", "code": "O-1", "goal_id": "goal-1", "title": "Count each day"}],
  "workflow_objectives": [
    {"workflow_id": "wf-keeps", "objective_id": "obj-1"},
    {"workflow_id": "wf-pipeline", "objective_id": "obj-1"},
    {"workflow_id": "wf-add", "objective_id": "obj-1"}
  ],
  "work_items": [
    {"id": "s1", "code": "WI-1", "workflow_id": "wf-keeps", "title": "Look at the days", "ordinality": 1, "kind": "fill_form", "role_id": "role-worker", "form_name": "Look", "questions": [{"prompt": "Seen", "answer_type": "free_text", "required": true}]},
    {"id": "s2", "code": "WI-2", "workflow_id": "wf-pipeline", "title": "Look at the pipeline", "ordinality": 1, "kind": "fill_form", "role_id": "role-worker", "form_name": "Look", "questions": [{"prompt": "Seen", "answer_type": "free_text", "required": true}]},
    {"id": "s3", "code": "WI-3", "workflow_id": "wf-add", "title": "Look at the hand entry", "ordinality": 1, "kind": "fill_form", "role_id": "role-worker", "form_name": "Look", "questions": [{"prompt": "Seen", "answer_type": "free_text", "required": true}]}
  ],
  "workflows": [
    {"id": "wf-keeps", "code": "WF-1", "name": "Keeps days worked"},
    {"id": "wf-pipeline", "code": "WF-2", "name": "Pipeline to payment", "subject_record": "CODE"},
    {"id": "wf-add", "code": "WF-3", "name": "Add a day worked by hand"}
  ],
  "records": [
    {
      "id": "rec-1", "code": "CODE", "workflow_id": "wf-keeps", "name": "Day worked",
      "role_id": "role-worker", "form_name": "Day worked", "item_name": "Day worked",
      "add_replaced_by": "WF-3",
      "questions": [{"prompt": "Hours", "answer_type": "number", "required": true}]
    }
  ],
  "home": [
    {"key": "days", "title": "Days worked", "target": {"type": "record", "ref": "CODE"}},
    {"key": "project-page", "title": "Project", "page_of": "CODE", "entries": [
      {"key": "page-days", "title": "Days on this project", "target": {"type": "record", "ref": "CODE"}}
    ]}
  ]
}`
	var doc map[string]any
	if err := json.Unmarshal([]byte(strings.ReplaceAll(text, "CODE", code)), &doc); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return doc
}

func importBodyOf(t *testing.T, doc map[string]any) json.RawMessage {
	t.Helper()
	body, err := json.Marshal(doc)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	return body
}

type importedWorld struct {
	homeWorld
	result importResult
}

func importRecordCoded(t *testing.T, code string) importedWorld {
	t.Helper()
	w := newHomeWorld(t)
	rec := w.call(t, "POST", "/instances/import", importBodyOf(t, recordCodedFile(t, code)), w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode import result: %v", err)
	}
	if len(result.Errors) > 0 {
		t.Fatalf("import errors: %v", result.Errors)
	}
	return importedWorld{homeWorld: w, result: result}
}

func (w importedWorld) draftRecords(t *testing.T) []models.Record {
	t.Helper()
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	records, err := mgr.ListRecords(context.Background(), w.result.DraftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	return records
}

func (w importedWorld) draftWorkflows(t *testing.T) []models.Workflow {
	t.Helper()
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	workflows, err := mgr.ListWorkflows(context.Background(), w.result.DraftID, mwanachamaagency.WorkflowFilter{})
	if err != nil {
		t.Fatalf("ListWorkflows: %v", err)
	}
	return workflows
}

func (w importedWorld) publishedHome(t *testing.T) []any {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.result.Instance.ID+"/publications", map[string]any{"draft_id": w.result.DraftID}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body.String())
	}
	out := w.callTool(t, "test-owner", homeContractTool, map[string]any{"instance_id": w.result.Instance.ID})
	return homeItems(t, out)
}

func assertRecordCodeKept(t *testing.T, code string) {
	t.Helper()
	w := importRecordCoded(t, code)

	records := w.draftRecords(t)
	if len(records) != 1 || records[0].Code != code {
		t.Fatalf("the imported records are %+v, want one record coded %q", records, code)
	}

	byName := map[string]models.Workflow{}
	generated := map[string]models.Workflow{}
	for _, wf := range w.draftWorkflows(t) {
		if wf.Generated {
			generated[wf.Code] = wf
			continue
		}
		byName[wf.Name] = wf
	}
	if got := byName["Pipeline to payment"].SubjectRecord; got != code {
		t.Errorf("the workflow's subject_record is %q, want %q", got, code)
	}
	if got := records[0].AddReplacedBy; got != byName["Add a day worked by hand"].Code {
		t.Errorf("the add stand-in is %q, want the code of %q", got, "Add a day worked by hand")
	}
	add, found := generated[code+".add"]
	if !found {
		t.Fatalf("no generated workflow %q; generated codes: %v", code+".add", keysOfWorkflows(generated))
	}
	if add.GeneratedFor != code || add.ReplacedBy != byName["Add a day worked by hand"].Code {
		t.Errorf("generated workflow %+v, want generated_for %q and replaced_by the stand-in", add, code)
	}

	home := w.publishedHome(t)
	days, found := nodeNamed(home, "days")
	if !found {
		t.Fatalf("the home entry that opens the record is missing: %v", homeKeysOf(home))
	}
	if target, _ := days["target"].(map[string]any); target["ref"] != code {
		t.Errorf("home entry days = %v, want the record %q", days, code)
	}
	page, found := nodeNamed(home, "project-page")
	if !found {
		t.Fatalf("the row page of the record is missing: %v", homeKeysOf(home))
	}
	if page["page_of"] != code {
		t.Errorf("page_of = %#v, want %q", page["page_of"], code)
	}
	if got := homeKeysOf(entriesOf(page)); len(got) != 1 || got[0] != "page-days" {
		t.Errorf("the row page holds %v, want [page-days]", got)
	}
}

func keysOfWorkflows(m map[string]models.Workflow) []string {
	var out []string
	for code := range m {
		out = append(out, code)
	}
	return out
}

func TestImportKeepsALowerCaseRecordCodeAndEveryReferenceToIt(t *testing.T) {
	assertRecordCodeKept(t, "day_worked")
}

func TestImportStillKeepsAnRCRecordCode(t *testing.T) {
	assertRecordCodeKept(t, "RC-12")
}

func TestImportRefusesAnInvalidRecordCodeNamingTheRecordAndTheCode(t *testing.T) {
	for _, code := range []string{
		"Day_worked",
		"day.worked",
		"day-worked",
		strings.Repeat("a", 49),
		"day__worked",
		"day_worked_",
		"_day_worked",
		"1day_worked",
		"day worked",
	} {
		w := newStepRunWalk(t, nil)
		doc := recordCodedFile(t, code)
		rec := w.call(t, "POST", "/instances/import", importBodyOf(t, doc), w.owner)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("code %q: import answered %d, want 400", code, rec.Code)
			continue
		}
		body := rec.Body.String()
		if !strings.Contains(body, `Day worked`) || !strings.Contains(body, code) {
			t.Errorf("code %q: the refusal does not name the record and the code: %s", code, body)
		}
	}
}

func TestImportKeepsARecordCodeOfFortyEightCharacters(t *testing.T) {
	code := strings.Repeat("a", 48)
	doc := recordCodedFile(t, code)
	delete(doc, "home")
	records, _, _ := importedRecordsOf(t, string(importBodyOf(t, doc)))
	if len(records) != 1 || records[0].Code != code {
		t.Errorf("the imported records are %+v, want one record coded %q", records, code)
	}
}

func TestImportRefusesARepeatedRecordCode(t *testing.T) {
	for _, code := range []string{"day_worked", "RC-12"} {
		w := newStepRunWalk(t, nil)
		doc := recordCodedFile(t, code)
		doc["workflows"] = append(doc["workflows"].([]any), map[string]any{"id": "wf-other", "code": "WF-4", "name": "Keeps tenders"})
		second := map[string]any{}
		for field, value := range doc["records"].([]any)[0].(map[string]any) {
			second[field] = value
		}
		second["id"], second["workflow_id"], second["name"] = "rec-2", "wf-other", "Tender"
		delete(second, "add_replaced_by")
		doc["records"] = append(doc["records"].([]any), second)
		rec := w.call(t, "POST", "/instances/import", importBodyOf(t, doc), w.owner)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("code %q: import answered %d, want 400", code, rec.Code)
			continue
		}
		body := rec.Body.String()
		if !strings.Contains(body, code) || !strings.Contains(body, "Tender") {
			t.Errorf("code %q: the refusal does not name the record and the code: %s", code, body)
		}
	}
}

func TestImportStillReplacesALowerCaseCodeOnAnythingButARecord(t *testing.T) {
	doc := recordCodedFile(t, "RC-1")
	doc["roles"].([]any)[0].(map[string]any)["code"] = "field_worker"
	_, _, roles := importedRecordsOf(t, string(importBodyOf(t, doc)))
	got := roles["Worker"].Code
	if got == "" || got == "field_worker" {
		t.Errorf("the role is coded %q, want the code the agency mints, not the file's", got)
	}
}
