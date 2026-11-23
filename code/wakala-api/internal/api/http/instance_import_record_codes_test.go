package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
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
    {"id": "s1", "code": "WI-1", "workflow_id": "wf-keeps", "title": "Look at the days", "ordinality": 1, "kind": "fill_form", "role_id": "role-worker", "form_name": "Look", "record_code": "CODE", "questions": [{"prompt": "Seen", "answer_type": "free_text", "required": true}]},
    {"id": "s2", "code": "WI-2", "workflow_id": "wf-pipeline", "title": "Look at the pipeline", "ordinality": 1, "kind": "fill_form", "role_id": "role-worker", "form_name": "Look", "questions": [{"prompt": "Seen", "answer_type": "free_text", "required": true}]},
    {"id": "s3", "code": "WI-3", "workflow_id": "wf-add", "title": "Look at the hand entry", "ordinality": 1, "kind": "fill_form", "role_id": "role-worker", "form_name": "Day worked", "row_record": "CODE", "row_action": "add", "questions": [{"prompt": "Hours", "answer_type": "number", "required": true}]}
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

	w.assertTheStepsFollowTheCode(t, code)
	w.assertTheGeneratedPartsCarryTheCode(t, code)
	w.assertADirectWriteNamesTheGeneratedWorkflow(t, code)
}

func (w importedWorld) assertTheStepsFollowTheCode(t *testing.T, code string) {
	t.Helper()
	byTitle := map[string]models.WorkItem{}
	for _, s := range w.draftSteps(t) {
		byTitle[s.Title] = s
	}
	if row := byTitle["Look at the hand entry"]; row.RowRecord != code || row.RowAction != "add" {
		t.Errorf("the row step writes %q/%q, want %q/add", row.RowRecord, row.RowAction, code)
	}
	kept := 0
	for _, r := range w.draftRecords(t) {
		if r.Code != code {
			continue
		}
		kept++
		if r.FormName != "Look" {
			t.Errorf("the publish left the record %q on the form %q, want the form of its step, Look", code, r.FormName)
		}
	}
	if kept != 1 {
		t.Errorf("%d records carry the code %q after the publish, want 1", kept, code)
	}
}

func (w importedWorld) assertTheGeneratedPartsCarryTheCode(t *testing.T, code string) {
	t.Helper()
	workflows := map[string]bool{}
	for _, wf := range w.draftWorkflows(t) {
		workflows[wf.Code] = wf.Generated
	}
	steps := map[string]string{}
	for _, s := range w.draftSteps(t) {
		steps[s.Code] = s.RowRecord
	}
	for _, action := range []string{"add", "edit", "delete"} {
		workflow, step := code+"."+action, code+"."+action+".1"
		if !workflows[workflow] {
			t.Errorf("no generated workflow %q after the publish", workflow)
		}
		if got, found := steps[step]; !found || got != code {
			t.Errorf("the generated step %q writes %q (found %v), want %q", step, got, found, code)
		}
	}
}

func (w importedWorld) assertADirectWriteNamesTheGeneratedWorkflow(t *testing.T, code string) {
	t.Helper()
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	for _, r := range w.draftRecords(t) {
		if r.Code != code {
			continue
		}
		var closed directRowClosedError
		err := directRowClosed(context.Background(), mgr, w.result.DraftID, r, "add")
		if !errors.As(err, &closed) || closed.workflowCode != code+".add" || closed.workflow != "Add a day worked" {
			t.Errorf("a direct add answered %v, want the closed door naming %q", err, code+".add")
		}
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
		rec := nothingCreatedAfter(t, w, importBodyOf(t, doc))
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

func TestImportKeepsARecordCodeOfFortyEightCharactersAndPublishesItsGeneratedCodes(t *testing.T) {
	assertRecordCodeKept(t, strings.Repeat("a", 48))
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
		rec := nothingCreatedAfter(t, w, importBodyOf(t, doc))
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

func nothingCreatedAfter(t *testing.T, w stepRunWalk, body json.RawMessage) *httptest.ResponseRecorder {
	t.Helper()
	before := instanceCount(t, w)
	rec := w.call(t, "POST", "/instances/import", body, w.owner)
	if after := instanceCount(t, w); after != before {
		t.Errorf("the refused import left %d new Instances behind, want none", after-before)
	}
	return rec
}

func TestImportRefusesARecordCodeAnotherSectionHoldsNamingBoth(t *testing.T) {
	for name, clash := range map[string]struct {
		section string
		index   int
		code    string
		other   string
	}{
		"a workflow":   {"workflows", 0, "W-1", "Keeps days worked"},
		"a role":       {"roles", 0, "R-1", "Worker"},
		"a goal":       {"goals", 0, "G-1", "Every day is counted"},
		"an objective": {"objectives", 0, "O-1", "Count each day"},
		"a work item":  {"work_items", 0, "WI-1", "Look at the days"},
	} {
		doc := recordCodedFile(t, clash.code)
		if clash.section != "roles" && clash.section != "goals" && clash.section != "objectives" && clash.section != "work_items" {
			doc[clash.section].([]any)[clash.index].(map[string]any)["code"] = clash.code
		}
		w := newStepRunWalk(t, nil)
		rec := nothingCreatedAfter(t, w, importBodyOf(t, doc))
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: import answered %d, want 400", name, rec.Code)
			continue
		}
		body := rec.Body.String()
		for _, want := range []string{"Day worked", clash.code, clash.other} {
			if !strings.Contains(body, want) {
				t.Errorf("%s: the refusal does not name %q: %s", name, want, body)
			}
		}
	}
}

func TestImportRefusesAStepRecordCodeAnotherSectionHolds(t *testing.T) {
	w := newStepRunWalk(t, nil)
	body := stepRecordCodesFile(t, func(doc map[string]any) {
		stepNamed(doc, "s1")["record_code"] = "WF-2"
	})
	rec := nothingCreatedAfter(t, w, body)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("import answered %d, want 400: %s", rec.Code, rec.Body.String())
	}
	for _, want := range []string{"Take the go or no go decision", "WF-2", "Keeps days worked"} {
		if !strings.Contains(rec.Body.String(), want) {
			t.Errorf("the refusal does not name %q: %s", want, rec.Body.String())
		}
	}
}

func TestImportRefusesARecordIdThatIsAnotherRecordsCode(t *testing.T) {
	doc := recordCodedFile(t, "day_worked")
	withASecondRecordCoded("tender")(doc)
	doc["records"].([]any)[1].(map[string]any)["id"] = "day_worked"
	w := newStepRunWalk(t, nil)
	rec := nothingCreatedAfter(t, w, importBodyOf(t, doc))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("import answered %d, want 400: %s", rec.Code, rec.Body.String())
	}
	for _, want := range []string{"Day worked", "Tender", "day_worked"} {
		if !strings.Contains(rec.Body.String(), want) {
			t.Errorf("the refusal does not name %q: %s", want, rec.Body.String())
		}
	}
}

func TestImportRefusesARecordIdThatIsAStepsRecordCode(t *testing.T) {
	w := newStepRunWalk(t, nil)
	body := stepRecordCodesFile(t, func(doc map[string]any) {
		doc["records"].([]any)[0].(map[string]any)["id"] = "bid_decision"
	})
	rec := nothingCreatedAfter(t, w, body)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("import answered %d, want 400: %s", rec.Code, rec.Body.String())
	}
	for _, want := range []string{"Day worked", "Take the go or no go decision", "bid_decision"} {
		if !strings.Contains(rec.Body.String(), want) {
			t.Errorf("the refusal does not name %q: %s", want, rec.Body.String())
		}
	}
}

func TestTheRecordCodeRuleQuotesOnlyCodesItAccepts(t *testing.T) {
	rule := recordCodeRule()
	for _, example := range []string{"tender", "day_worked", "RC-12", "W-1"} {
		if !strings.Contains(rule, example) {
			t.Errorf("the rule %q does not quote %q", rule, example)
		}
		if !validRecordCode(example) {
			t.Errorf("the rule quotes %q, which validRecordCode refuses", example)
		}
	}
}
