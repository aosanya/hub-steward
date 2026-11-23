package http

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	"github.com/aosanya/mwanachama-backend-agency/models"
)

const recordSettingsAgency = `{
  "name": "Record settings agency",
  "roles": [
    {"id": "role-add", "code": "R-1", "name": "Adder"},
    {"id": "role-edit", "code": "R-2", "name": "Editor"},
    {"id": "role-delete", "code": "R-3", "name": "Deleter"},
    {"id": "role-view", "code": "R-4", "name": "Viewer"}
  ],
  "workflows": [
    {"id": "wf-keeps", "code": "WF-1", "name": "Keeps tenders"},
    {"id": "wf-add", "code": "WF-2", "name": "Add a tender"},
    {"id": "wf-edit", "code": "WF-3", "name": "Edit a tender"},
    {"id": "wf-delete", "code": "WF-4", "name": "Delete a tender"}
  ],
  "records": [
    {
      "id": "rec-1", "code": "RC-1", "workflow_id": "wf-keeps", "name": "Tenders",
      "role_id": "R-1", "edit_role_id": "role-edit", "delete_role_id": "R-3", "viewer_role_id": "role-view",
      "form_name": "Tender", "item_name": "Tender",
      "add_replaced_by": "WF-2", "edit_replaced_by": "wf-edit", "delete_replaced_by": "WF-4",
      "questions": [{"prompt": "Tender title", "answer_type": "free_text", "required": true}]
    }
  ]
}`

func importedRecordsOf(t *testing.T, body string) ([]models.Record, map[string]models.Workflow, map[string]models.Role) {
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
	if len(result.Errors) > 0 {
		t.Fatalf("import errors: %v", result.Errors)
	}
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	records, err := mgr.ListRecords(ctx, result.DraftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	workflows, err := mgr.ListWorkflows(ctx, result.DraftID, mwanachamaagency.WorkflowFilter{})
	if err != nil {
		t.Fatalf("ListWorkflows: %v", err)
	}
	roles, err := mgr.ListRoles(ctx, result.DraftID, mwanachamaagency.RoleFilter{})
	if err != nil {
		t.Fatalf("ListRoles: %v", err)
	}
	workflowByName := map[string]models.Workflow{}
	for _, wf := range workflows {
		if wf.Generated {
			continue
		}
		workflowByName[wf.Name] = wf
	}
	roleByName := map[string]models.Role{}
	for _, r := range roles {
		roleByName[r.Name] = r
	}
	return records, workflowByName, roleByName
}

func TestImportKeepsEveryRecordSetting(t *testing.T) {
	records, workflows, roles := importedRecordsOf(t, recordSettingsAgency)
	if len(records) != 1 {
		t.Fatalf("want one record, got %d", len(records))
	}
	got := records[0]
	want := map[string][2]string{
		"item name":       {got.ItemName, "Tender"},
		"adding role":     {got.RoleID, roles["Adder"].ID},
		"editing role":    {got.EditRoleID, roles["Editor"].ID},
		"deleting role":   {got.DeleteRoleID, roles["Deleter"].ID},
		"viewing role":    {got.ViewerRoleID, roles["Viewer"].ID},
		"add stand-in":    {got.AddReplacedBy, workflows["Add a tender"].Code},
		"edit stand-in":   {got.EditReplacedBy, workflows["Edit a tender"].Code},
		"delete stand-in": {got.DeleteReplacedBy, workflows["Delete a tender"].Code},
	}
	for name, pair := range want {
		if pair[0] == "" || pair[0] != pair[1] {
			t.Errorf("%s: got %q, want %q", name, pair[0], pair[1])
		}
	}
}

func TestImportRefusesARecordSettingNamingAnUnknownRole(t *testing.T) {
	for _, field := range []string{"edit_role_id", "delete_role_id", "viewer_role_id"} {
		var doc map[string]any
		if err := json.Unmarshal([]byte(recordSettingsAgency), &doc); err != nil {
			t.Fatalf("decode: %v", err)
		}
		doc["records"].([]any)[0].(map[string]any)[field] = "R-99"
		body, err := json.Marshal(doc)
		if err != nil {
			t.Fatalf("encode: %v", err)
		}
		w := newStepRunWalk(t, nil)
		rec := w.call(t, "POST", "/instances/import", json.RawMessage(body), w.owner)
		var result importResult
		if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
			t.Fatalf("%s: decode: %v", field, err)
		}
		if len(result.Errors) == 0 {
			t.Errorf("%s naming an unknown role was imported without an error", field)
		}
	}
}

func TestImportResolvesStandInsByIdWhenTheFileGivesNoCodes(t *testing.T) {
	var doc map[string]any
	if err := json.Unmarshal([]byte(recordSettingsAgency), &doc); err != nil {
		t.Fatalf("decode: %v", err)
	}
	for _, wf := range doc["workflows"].([]any) {
		delete(wf.(map[string]any), "code")
	}
	record := doc["records"].([]any)[0].(map[string]any)
	record["add_replaced_by"] = "wf-add"
	record["delete_replaced_by"] = "wf-delete"
	body, err := json.Marshal(doc)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	records, workflows, _ := importedRecordsOf(t, string(body))
	got := records[0]
	for name, pair := range map[string][2]string{
		"add stand-in":    {got.AddReplacedBy, workflows["Add a tender"].Code},
		"edit stand-in":   {got.EditReplacedBy, workflows["Edit a tender"].Code},
		"delete stand-in": {got.DeleteReplacedBy, workflows["Delete a tender"].Code},
	} {
		if pair[1] == "" || pair[0] != pair[1] {
			t.Errorf("%s: got %q, want the minted code %q", name, pair[0], pair[1])
		}
	}
}
