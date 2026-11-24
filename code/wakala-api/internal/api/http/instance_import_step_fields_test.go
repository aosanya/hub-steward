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

const sendBackAgency = `{
  "name": "Send back agency",
  "roles": [{"id": "role-approver", "code": "R-1", "name": "Approver"}],
  "workflows": [{"id": "wf-approval", "code": "WF-1", "name": "Approval for submission"}],
  "work_items": [
    {
      "id": "wi-approve", "code": "WI-1", "workflow_id": "wf-approval", "title": "Approve the submission",
      "ordinality": 1, "kind": "fill_form", "role_id": "role-approver", "form_name": "Approval",
      "send_back_decision": "Approved", "send_back_reason": "Reason",
      "questions": [
        {"prompt": "Approved", "answer_type": "yes_no", "required": true},
        {"prompt": "Reason", "answer_type": "free_text", "required": false}
      ]
    }
  ]
}`

func importOutcomeOf(t *testing.T, body string) (importResult, mwanachamaagency.AgencyManager) {
	t.Helper()
	w := newStepRunWalk(t, nil)
	rec := w.call(t, "POST", "/instances/import", json.RawMessage(body), w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode import result: %v", err)
	}
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	return result, mgr
}

func importedStepsOf(t *testing.T, body string) ([]models.WorkItem, importResult) {
	t.Helper()
	result, mgr := importOutcomeOf(t, body)
	if len(result.Errors) > 0 {
		t.Fatalf("import errors: %v", result.Errors)
	}
	steps, err := mgr.ListWorkItems(context.Background(), result.DraftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		t.Fatalf("ListWorkItems: %v", err)
	}
	return steps, result
}

func importedStepsAndRecordsOf(t *testing.T, body string) ([]models.WorkItem, importResult, []models.Record) {
	t.Helper()
	result, mgr := importOutcomeOf(t, body)
	if len(result.Errors) > 0 {
		t.Fatalf("import errors: %v", result.Errors)
	}
	steps, err := mgr.ListWorkItems(context.Background(), result.DraftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		t.Fatalf("ListWorkItems: %v", err)
	}
	records, err := mgr.ListRecords(context.Background(), result.DraftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	return steps, result, records
}

func stepTitled(t *testing.T, steps []models.WorkItem, title string) models.WorkItem {
	t.Helper()
	for _, s := range steps {
		if s.Title == title {
			return s
		}
	}
	t.Fatalf("no step titled %q among %d steps", title, len(steps))
	return models.WorkItem{}
}

func TestImportKeepsTheSendBackPromptsOfAStep(t *testing.T) {
	steps, _ := importedStepsOf(t, sendBackAgency)
	step := stepTitled(t, steps, "Approve the submission")
	if step.SendBackDecision != "Approved" || step.SendBackReason != "Reason" {
		t.Errorf("send back prompts: got %q and %q, want Approved and Reason", step.SendBackDecision, step.SendBackReason)
	}
}

func TestImportRefusesASendBackStepWhoseDecisionIsNotAQuestionOfTheForm(t *testing.T) {
	body := strings.Replace(sendBackAgency, `"send_back_decision": "Approved"`, `"send_back_decision": "Missing"`, 1)
	result, _ := importOutcomeOf(t, body)
	if len(result.Errors) != 1 || !strings.Contains(result.Errors[0], `the decision of a send back is the question "Missing", which the step's form does not ask`) {
		t.Errorf("want the sibling's send back message, got %v", result.Errors)
	}
}

func TestImportRefusesASendBackStepWithOnlyOnePrompt(t *testing.T) {
	body := strings.Replace(sendBackAgency, `"send_back_reason": "Reason",`, ``, 1)
	result, _ := importOutcomeOf(t, body)
	if len(result.Errors) != 1 || !strings.Contains(result.Errors[0], "names the free text question that holds the reason") {
		t.Errorf("want the sibling's send back message, got %v", result.Errors)
	}
}

const rowStepAgency = `{
  "name": "Row step agency",
  "roles": [{"id": "role-clerk", "code": "R-1", "name": "Clerk"}],
  "workflows": [
    {"id": "wf-keeps", "code": "WF-1", "name": "Keeps tenders"},
    {"id": "wf-add", "code": "WF-3", "name": "Add a tender by hand"},
    {"id": "wf-fix", "code": "WF-2", "name": "Fix a tender"}
  ],
  "work_items": [
    {
      "id": "wi-add", "code": "WI-8", "workflow_id": "wf-add", "title": "Add a tender by hand",
      "ordinality": 1, "kind": "fill_form", "role_id": "role-clerk", "form_name": "Tender",
      "row_record": "RC-1", "row_action": "add",
      "questions": [{"prompt": "Tender title", "answer_type": "free_text", "required": true}]
    },
    {
      "id": "wi-fix", "code": "WI-9", "workflow_id": "wf-fix", "title": "Fix a tender",
      "ordinality": 1, "kind": "fill_form", "role_id": "role-clerk", "form_name": "Tender",
      "row_record": "rec-1", "row_action": "edit",
      "questions": [{"prompt": "Tender title", "answer_type": "free_text", "required": true}]
    }
  ],
  "records": [
    {
      "id": "rec-1", "code": "RC-1", "workflow_id": "wf-keeps", "name": "Tenders",
      "role_id": "role-clerk", "form_name": "Tender", "item_name": "Tender",
      "questions": [{"prompt": "Tender title", "answer_type": "free_text", "required": true}]
    }
  ]
}`

func TestImportKeepsTheRowRecordAndRowActionOfAStep(t *testing.T) {
	steps, result, records := importedStepsAndRecordsOf(t, rowStepAgency)
	if len(records) != 1 {
		t.Fatalf("want one imported record, got %+v in %v", records, result.Created)
	}
	want := map[string][2]string{
		"Add a tender by hand": {records[0].Key, "add"},
		"Fix a tender":         {records[0].Key, "edit"},
	}
	byTitle := map[string][]models.WorkItem{}
	for _, s := range steps {
		byTitle[s.Title] = append(byTitle[s.Title], s)
	}
	for title, pair := range want {
		if len(byTitle[title]) != 1 {
			t.Fatalf("want one step titled %q, got %d", title, len(byTitle[title]))
		}
		got := byTitle[title][0]
		if got.RowRecord != pair[0] || got.RowAction != pair[1] {
			t.Errorf("%s: got row record %q action %q, want %q %q", title, got.RowRecord, got.RowAction, pair[0], pair[1])
		}
	}
}

func TestImportRefusesARowStepWithoutAnAction(t *testing.T) {
	body := strings.Replace(rowStepAgency, `"row_record": "rec-1", "row_action": "edit"`, `"row_record": "rec-1"`, 1)
	result, _ := importOutcomeOf(t, body)
	if len(result.Errors) != 1 || !strings.Contains(result.Errors[0], "says whether it adds, edits or deletes a row") {
		t.Errorf("want the sibling's row step message, got %v", result.Errors)
	}
}

func TestImportRefusesARowStepNamingAnUnknownRecord(t *testing.T) {
	body := strings.Replace(rowStepAgency, `"row_record": "rec-1"`, `"row_record": "rec-99"`, 1)
	result, _ := importOutcomeOf(t, body)
	if len(result.Errors) != 1 || !strings.Contains(result.Errors[0], "rec-99") {
		t.Errorf("want one error naming the unknown record, got %v", result.Errors)
	}
}
