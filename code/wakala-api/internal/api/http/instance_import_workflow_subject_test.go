package http

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

const subjectAgency = `{
  "name": "Subject agency",
  "roles": [
    {"id": "role-scout", "code": "R-1", "name": "Scout"},
    {"id": "role-director", "code": "R-2", "name": "Director"}
  ],
  "workflows": [
    {"id": "wf-keeps", "code": "WF-1", "name": "Keeps tenders"},
    {"id": "wf-pipeline", "code": "WF-2", "name": "Pipeline to submission", "subject_record": "RC-1"}
  ],
  "records": [
    {
      "id": "rec-1", "code": "RC-1", "workflow_id": "wf-keeps", "name": "Tenders",
      "role_id": "R-1", "form_name": "Tender", "item_name": "tender",
      "questions": [{"prompt": "Tender title", "answer_type": "free_text", "required": true}]
    }
  ]
}`

func subjectAgencyNaming(t *testing.T, record string) string {
	t.Helper()
	var doc map[string]any
	if err := json.Unmarshal([]byte(subjectAgency), &doc); err != nil {
		t.Fatalf("decode: %v", err)
	}
	doc["workflows"].([]any)[1].(map[string]any)["subject_record"] = record
	body, err := json.Marshal(doc)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	return string(body)
}

func TestImportKeepsTheSubjectRecordOfAWorkflow(t *testing.T) {
	_, workflows, _ := importedRecordsOf(t, subjectAgency)
	read, err := json.Marshal(workflows["Pipeline to submission"])
	if err != nil {
		t.Fatalf("encode workflow: %v", err)
	}
	var fields map[string]any
	if err := json.Unmarshal(read, &fields); err != nil {
		t.Fatalf("decode workflow: %v", err)
	}
	if fields["subject_record"] != "RC-1" {
		t.Errorf("the imported workflow carries subject_record %v, want RC-1", fields["subject_record"])
	}
}

func TestImportRefusesAWorkflowWhoseSubjectRecordIsNotInTheFile(t *testing.T) {
	w := newStepRunWalk(t, nil)
	rec := w.call(t, "POST", "/instances/import", json.RawMessage(subjectAgencyNaming(t, "RC-9")), w.owner)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("import answered %d %s, want 400", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "RC-9") {
		t.Errorf("the refusal does not name the missing record: %s", rec.Body.String())
	}
}
