package http

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	"github.com/aosanya/mwanachama-backend-agency/models"
)

const stepRecordCodesAgency = `{
  "name": "Step record codes agency",
  "roles": [
    {"id": "role-worker", "code": "R-1", "name": "Worker"}
  ],
  "goals": [{"id": "goal-1", "code": "G-1", "title": "Every bid is decided"}],
  "objectives": [{"id": "obj-1", "code": "O-1", "goal_id": "goal-1", "title": "Decide each bid"}],
  "workflow_objectives": [
    {"workflow_id": "wf-bid", "objective_id": "obj-1"},
    {"workflow_id": "wf-days", "objective_id": "obj-1"},
    {"workflow_id": "wf-follow", "objective_id": "obj-1"},
    {"workflow_id": "wf-old", "objective_id": "obj-1"}
  ],
  "workflows": [
    {"id": "wf-bid", "code": "WF-1", "name": "Decide on a bid"},
    {"id": "wf-days", "code": "WF-2", "name": "Keeps days worked"},
    {"id": "wf-follow", "code": "WF-3", "name": "Follow the bid"},
    {"id": "wf-old", "code": "WF-4", "name": "Check in"}
  ],
  "work_items": [
    {"id": "s1", "code": "WI-1", "workflow_id": "wf-bid", "title": "Take the go or no go decision", "ordinality": 1, "kind": "fill_form", "role_id": "role-worker", "form_name": "Go or no go", "record_code": "bid_decision", "questions": [{"prompt": "Go", "answer_type": "free_text", "required": true}]},
    {"id": "s2", "code": "WI-2", "workflow_id": "wf-days", "title": "Count the day", "ordinality": 1, "kind": "fill_form", "role_id": "role-worker", "form_name": "Day worked", "record_code": "day_worked", "questions": [{"prompt": "Hours", "answer_type": "number", "required": true}]},
    {"id": "s4", "code": "WI-4", "workflow_id": "wf-follow", "title": "Talk it over", "ordinality": 1, "kind": "notify", "role_id": "role-worker", "recipient_role_id": "role-worker", "prompt": "The bid is open", "form_name": "Bid open", "questions": [{"prompt": "Seen", "answer_type": "free_text", "required": true}]},
    {"id": "s3", "code": "WI-3", "workflow_id": "wf-old", "title": "Check the arrival", "ordinality": 1, "kind": "fill_form", "role_id": "role-worker", "form_name": "Arrival", "questions": [{"prompt": "Arrived", "answer_type": "free_text", "required": true}]}
  ],
  "records": [
    {
      "id": "rec-days", "code": "day_worked", "workflow_id": "wf-days", "name": "Day worked",
      "role_id": "role-worker", "form_name": "Day worked", "item_name": "Day worked",
      "questions": [{"prompt": "Hours", "answer_type": "number", "required": true}]
    }
  ]
}`

func namingTheStepRecordInTheHomeAndASubject(doc map[string]any) {
	doc["workflows"].([]any)[2].(map[string]any)["subject_record"] = "bid_decision"
	var home []any
	if err := json.Unmarshal([]byte(`[
    {"key": "bids", "title": "Bid decisions", "target": {"type": "record", "ref": "bid_decision"}},
    {"key": "bid-page", "title": "Bid", "page_of": "bid_decision", "entries": [
      {"key": "bid-days", "title": "Days on this bid", "target": {"type": "record", "ref": "day_worked"}}
    ]}
  ]`), &home); err != nil {
		panic(err)
	}
	doc["home"] = home
}

func stepRecordCodesFile(t *testing.T, edit func(doc map[string]any)) json.RawMessage {
	t.Helper()
	var doc map[string]any
	if err := json.Unmarshal([]byte(stepRecordCodesAgency), &doc); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if edit != nil {
		edit(doc)
	}
	return importBodyOf(t, doc)
}

func stepNamed(doc map[string]any, id string) map[string]any {
	for _, s := range doc["work_items"].([]any) {
		if step := s.(map[string]any); step["id"] == id {
			return step
		}
	}
	return nil
}

func importStepRecordCodes(t *testing.T, body json.RawMessage) importedWorld {
	t.Helper()
	w := newHomeWorld(t)
	rec := w.call(t, "POST", "/instances/import", body, w.owner)
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

func (w importedWorld) publish(t *testing.T) {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.result.Instance.ID+"/publications", map[string]any{"draft_id": w.result.DraftID}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body.String())
	}
}

func (w importedWorld) draftSteps(t *testing.T) []models.WorkItem {
	t.Helper()
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	steps, err := mgr.ListWorkItems(context.Background(), w.result.DraftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		t.Fatalf("ListWorkItems: %v", err)
	}
	return steps
}

func recordsByCode(records []models.Record) map[string]models.Record {
	byCode := map[string]models.Record{}
	for _, r := range records {
		byCode[r.Code] = r
	}
	return byCode
}

func TestImportDerivesTheRecordAFormStepNamesFromItsCode(t *testing.T) {
	w := importStepRecordCodes(t, stepRecordCodesFile(t, nil))

	got, found := recordsByCode(w.draftRecords(t))["bid_decision"]
	if !found {
		t.Fatalf("no record coded bid_decision at import; records: %+v", w.draftRecords(t))
	}
	if got.Name != "Bid decision" || got.FormName != "Go or no go" || got.RoleID == "" || len(got.Questions) != 1 {
		t.Errorf("the derived record is %+v, want the name Bid decision and the role, form and questions of its step", got)
	}
}

func TestImportAdoptsTheDeclaredRecordAFormStepNamesByCodeAndDerivesNoSecond(t *testing.T) {
	w := importStepRecordCodes(t, stepRecordCodesFile(t, nil))
	w.publish(t)

	records := w.draftRecords(t)
	byCode := recordsByCode(records)
	if len(records) != 3 {
		t.Fatalf("the draft holds %d records after the publish, want 3 (day_worked, bid_decision, one for the step with no code): %+v", len(records), records)
	}
	if got := byCode["day_worked"]; got.Name != "Day worked" {
		t.Errorf("the adopted record is %+v, want the declared one named Day worked", got)
	}
	for _, r := range records {
		if r.Name == "Count the day" || r.Name == "Take the go or no go decision" {
			t.Errorf("the platform derived %q from a step title although the step names its record", r.Name)
		}
	}

	steps := w.draftSteps(t)
	names := stepRecordNames(steps)
	for _, s := range steps {
		want := map[string]string{"Take the go or no go decision": "bid_decision", "Count the day": "day_worked"}[s.Title]
		if want == "" {
			continue
		}
		have, ok := recordOfStep(records, s, names[s.ID])
		if !ok || have.Code != want {
			t.Errorf("the step %q writes to %+v, want the record %q", s.Title, have, want)
		}
	}
}

func TestImportNamesAStepRecordInTheHomeAndTheSubjectOfAWorkflow(t *testing.T) {
	w := importStepRecordCodes(t, stepRecordCodesFile(t, namingTheStepRecordInTheHomeAndASubject))

	for _, wf := range w.draftWorkflows(t) {
		if wf.Name == "Follow the bid" && wf.SubjectRecord != "bid_decision" {
			t.Errorf("the workflow's subject_record is %q, want bid_decision", wf.SubjectRecord)
		}
	}

	home := w.publishedHome(t)
	bids, found := nodeNamed(home, "bids")
	if !found {
		t.Fatalf("the home entry that opens the step's record is missing: %v", homeKeysOf(home))
	}
	if target, _ := bids["target"].(map[string]any); target["ref"] != "bid_decision" {
		t.Errorf("home entry bids = %v, want the record bid_decision", bids)
	}
	page, found := nodeNamed(home, "bid-page")
	if !found || page["page_of"] != "bid_decision" {
		t.Errorf("the row page of the step's record is %v (found %v), want page_of bid_decision", page, found)
	}
}

func TestImportOfAFileWithoutRecordCodesDerivesRecordsFromTheStepTitlesAsBefore(t *testing.T) {
	body := stepRecordCodesFile(t, func(doc map[string]any) {
		delete(stepNamed(doc, "s1"), "record_code")
		delete(stepNamed(doc, "s2"), "record_code")
	})
	w := importStepRecordCodes(t, body)
	w.publish(t)

	byName := map[string]models.Record{}
	for _, r := range w.draftRecords(t) {
		byName[r.Name] = r
	}
	rc := regexp.MustCompile(`^RC-[0-9]+$`)
	for _, title := range []string{"Take the go or no go decision", "Check the arrival"} {
		if r, ok := byName[title]; !ok || !rc.MatchString(r.Code) {
			t.Errorf("the step %q derived %+v, want a record named like the step with an RC-n code", title, r)
		}
	}
	if r := byName["Day worked"]; r.Code != "day_worked" {
		t.Errorf("the declared record is %+v, want it kept as day_worked", r)
	}
	if _, ok := byName["Bid decision"]; ok {
		t.Errorf("a record named Bid decision exists although no step names bid_decision")
	}
}

func TestSecondPublishKeepsTheCodeOfAStepRecord(t *testing.T) {
	w := importStepRecordCodes(t, stepRecordCodesFile(t, nil))
	w.publish(t)
	first := recordsByCode(w.draftRecords(t))

	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	for _, s := range w.draftSteps(t) {
		if s.Title != "Take the go or no go decision" {
			continue
		}
		s.Title = "Decide whether to bid"
		s.Questions = append(s.Questions, models.StepQuestion{Prompt: "Reason", AnswerType: models.AnswerFreeText})
		if _, err := mgr.UpdateWorkItem(context.Background(), s); err != nil {
			t.Fatalf("UpdateWorkItem: %v", err)
		}
	}
	w.publish(t)
	second := recordsByCode(w.draftRecords(t))

	if len(second) != len(first) {
		t.Errorf("the second publish leaves %d records, the first left %d", len(second), len(first))
	}
	for _, code := range []string{"bid_decision", "day_worked"} {
		if first[code].ID == "" || second[code].ID != first[code].ID {
			t.Errorf("record %q: first publish %+v, second %+v, want the same record", code, first[code], second[code])
		}
	}
	if got := len(second["bid_decision"].Questions); got != 2 {
		t.Errorf("the record bid_decision has %d questions after its step gained one, want 2", got)
	}
}

func refusedStepRecordCode(t *testing.T, edit func(doc map[string]any), wants ...string) {
	t.Helper()
	w := newStepRunWalk(t, nil)
	rec := w.call(t, "POST", "/instances/import", stepRecordCodesFile(t, edit), w.owner)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("import answered %d, want 400: %s", rec.Code, rec.Body.String())
	}
	for _, want := range wants {
		if !strings.Contains(rec.Body.String(), want) {
			t.Errorf("the refusal does not name %q: %s", want, rec.Body.String())
		}
	}
}

func TestImportRefusesTwoStepsNamingTheSameRecordCode(t *testing.T) {
	refusedStepRecordCode(t, func(doc map[string]any) {
		stepNamed(doc, "s3")["record_code"] = "bid_decision"
	}, "bid_decision", "Take the go or no go decision", "Check the arrival")
}

func TestImportRefusesAnInvalidRecordCodeOnAStepNamingTheStepAndTheCode(t *testing.T) {
	for _, code := range []string{"Bid_decision", "bid.decision", "bid-decision", "bid decision", strings.Repeat("a", 49)} {
		refusedStepRecordCode(t, func(doc map[string]any) {
			stepNamed(doc, "s1")["record_code"] = code
		}, "Take the go or no go decision", code)
	}
}

func TestImportRefusesAStepWhoseDeclaredRecordBelongsToAnotherWorkflow(t *testing.T) {
	refusedStepRecordCode(t, func(doc map[string]any) {
		stepNamed(doc, "s3")["record_code"] = "day_worked"
		delete(stepNamed(doc, "s2"), "record_code")
	}, "day_worked", "Check the arrival")
}

func TestImportRefusesARecordCodeOnAStepThatIsNotAFormStepOrWritesARow(t *testing.T) {
	refusedStepRecordCode(t, func(doc map[string]any) {
		stepNamed(doc, "s3")["kind"] = "notify"
		stepNamed(doc, "s3")["record_code"] = "arrival"
	}, "Check the arrival", "arrival")
	refusedStepRecordCode(t, func(doc map[string]any) {
		stepNamed(doc, "s3")["row_record"] = "day_worked"
		stepNamed(doc, "s3")["row_action"] = "add"
		stepNamed(doc, "s3")["record_code"] = "arrival"
	}, "Check the arrival", "arrival")
}

func publishedAfterCodingTheStep(t *testing.T, title, code string) []models.Record {
	t.Helper()
	w := importStepRecordCodes(t, stepRecordCodesFile(t, nil))
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	for _, s := range w.draftSteps(t) {
		if s.Title != title {
			continue
		}
		s.RecordCode = code
		if _, err := mgr.UpdateWorkItem(context.Background(), s); err != nil {
			t.Fatalf("UpdateWorkItem: %v", err)
		}
	}
	w.publish(t)
	return w.draftRecords(t)
}

func TestPublishCreatesNoRecordForAStepCodeThatIsNotValid(t *testing.T) {
	for _, r := range publishedAfterCodingTheStep(t, "Check the arrival", "Check Arrival") {
		if r.Code == "Check Arrival" {
			t.Errorf("the publish created the record %+v from a code the import would refuse", r)
		}
	}
}

func TestPublishCreatesNoSecondRecordForACodeAnotherWorkflowHolds(t *testing.T) {
	held := 0
	for _, r := range publishedAfterCodingTheStep(t, "Check the arrival", "day_worked") {
		if r.Code == "day_worked" {
			held++
		}
	}
	if held != 1 {
		t.Errorf("%d records carry the code day_worked after the publish, want 1", held)
	}
}

func TestLaunchImportReportsAStepRecordCodeItCannotKeep(t *testing.T) {
	w := newStepRunWalk(t, nil)
	for name, edit := range map[string]func(doc map[string]any){
		"not valid": func(doc map[string]any) { stepNamed(doc, "s1")["record_code"] = "Bid Decision" },
		"repeated":  func(doc map[string]any) { stepNamed(doc, "s3")["record_code"] = "bid_decision" },
	} {
		var in importRequest
		if err := json.Unmarshal(stepRecordCodesFile(t, edit), &in); err != nil {
			t.Fatalf("decode: %v", err)
		}
		res, err := runImport(context.Background(), w.deps.Registry, "", "Launched "+name, in)
		if err != nil {
			t.Fatalf("%s: runImport: %v", name, err)
		}
		if len(res.Errors) == 0 {
			t.Errorf("%s: the importer reported no error for a record code it cannot keep", name)
		}
	}
}
