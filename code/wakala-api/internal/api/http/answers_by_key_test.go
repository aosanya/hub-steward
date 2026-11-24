package http

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type fieldNames struct{ key, code, prompt string }

func (p consultantPoolWalk) fieldsOfThePool(t *testing.T) map[string]fieldNames {
	t.Helper()
	mgr, err := p.deps.Registry.AgencyManager(context.Background(), p.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	records, err := mgr.ListRecords(context.Background(), p.draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	fields := map[string]fieldNames{}
	for _, r := range records {
		if r.Code != p.pool {
			continue
		}
		for _, q := range r.Questions {
			fields[q.Prompt] = fieldNames{key: q.Key, code: q.Code, prompt: q.Prompt}
		}
	}
	if len(fields) == 0 {
		t.Fatalf("the record %s has no fields in the draft", p.pool)
	}
	return fields
}

func (p consultantPoolWalk) rowsOverHTTP(t *testing.T) []agencymodels.RecordRow {
	t.Helper()
	rec := p.call(t, "GET", "/instances/"+p.instance+"/live-records/"+p.pool+"/rows", nil, p.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("list rows: %d %s", rec.Code, rec.Body.String())
	}
	var rows []agencymodels.RecordRow
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	return rows
}

func (p consultantPoolWalk) rowsFoundBy(t *testing.T, where ...poolCondition) int {
	t.Helper()
	args := map[string]any{"instance_id": p.instance, "record_code": p.pool, "where": where}
	out := designAgentWalk{stepRunWalk: p.stepRunWalk}.mcpCall(t, "test-owner", listLiveRecordRowsTool, args)
	if out.IsError {
		t.Fatalf("search refused with %q", toolErrorText(out))
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	var body struct {
		Items []agencymodels.RecordRow `json:"items"`
	}
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatalf("structured content %s does not carry items: %v", encoded, err)
	}
	return len(body.Items)
}

func TestARowReadReturnsItsAnswersUnderTheFieldKey(t *testing.T) {
	p := consultantPool(t)
	fields := p.fieldsOfThePool(t)

	rows := p.rowsOverHTTP(t)
	if len(rows) != len(consultantPoolOfEight) {
		t.Fatalf("the read returned %d rows, want %d", len(rows), len(consultantPoolOfEight))
	}
	nameKey := fields["Name"].key
	if nameKey == "" {
		t.Fatalf("the field Name has no key: %+v", fields["Name"])
	}
	for _, row := range rows {
		if row.Answers[nameKey] == "" {
			t.Errorf("a row's answers are %v, want the name under the key %s", row.Answers, nameKey)
		}
		if _, byPrompt := row.Answers["Name"]; byPrompt {
			t.Errorf("a row's answers are %v, want no answer under the prompt Name", row.Answers)
		}
	}
}

func TestAConditionNamesAFieldByItsKeyItsCodeOrItsPrompt(t *testing.T) {
	p := consultantPool(t)
	status := p.fieldsOfThePool(t)["Status"]
	if status.key == "" || status.code == "" {
		t.Fatalf("the field Status has no key or code: %+v", status)
	}

	for what, name := range map[string]string{"key": status.key, "code": status.code, "prompt": status.prompt} {
		if got := p.rowsFoundBy(t, poolIs(name, "Active")); got != 7 {
			t.Errorf("a condition naming Status by its %s found %d rows, want the 7 active consultants", what, got)
		}
	}
}

func TestAMultiSelectConditionByKeyFindsTheSameRowsAsByPrompt(t *testing.T) {
	p := consultantPool(t)
	countries := p.fieldsOfThePool(t)["Countries"]

	byPrompt := p.rowsFoundBy(t, poolContains("Countries", "Senegal"))
	byKey := p.rowsFoundBy(t, poolContains(countries.key, "Senegal"))
	if byPrompt != 1 || byKey != byPrompt {
		t.Errorf("Senegal was found in %d rows by the prompt and %d by the key, want 1 and 1", byPrompt, byKey)
	}
}

const olderFileWithRoleAssignments = `{
  "name": "Older file",
  "roles": [
    {"id": "role-worker", "code": "R-1", "name": "Worker"},
    {"id": "role-lead", "code": "R-2", "name": "Lead"}
  ],
  "goals": [{"id": "goal-1", "code": "G-1", "title": "Every bid is decided"}],
  "objectives": [{"id": "obj-1", "code": "O-1", "goal_id": "goal-1", "title": "Decide each bid"}],
  "workflow_objectives": [{"workflow_id": "wf-1", "objective_id": "obj-1"}],
  "workflows": [{"id": "wf-1", "code": "WF-1", "name": "Decide on a bid"}],
  "work_items": [
    {"id": "s1", "code": "WI-1", "workflow_id": "wf-1", "title": "Take the decision", "ordinality": 1, "kind": "fill_form", "role_id": "role-worker", "form_name": "Decision", "questions": [{"prompt": "Go", "answer_type": "free_text", "required": true}]},
    {"id": "s2", "code": "WI-2", "workflow_id": "wf-1", "title": "Sign it off", "ordinality": 2, "kind": "fill_form", "role_id": "role-worker", "form_name": "Sign off", "questions": [{"prompt": "Signed", "answer_type": "free_text", "required": true}]},
    {"id": "s3", "code": "WI-3", "workflow_id": "wf-1", "title": "File it", "ordinality": 3, "kind": "fill_form", "form_name": "Filing", "questions": [{"prompt": "Filed", "answer_type": "free_text", "required": true}]}
  ],
  "role_assignments": [
    {"work_item_id": "s1", "role_id": "role-lead", "label": "accountable"},
    {"work_item_id": "s1", "role_id": "role-worker", "label": "responsible"},
    {"work_item_id": "s2", "role_id": "role-worker", "label": "accountable"},
    {"work_item_id": "s2", "role_id": "role-lead", "label": "consulted"},
    {"work_item_id": "s3", "role_id": "role-lead", "label": "accountable"}
  ]
}`

func (w importedWorld) accountableRoleNamesByStep(t *testing.T) map[string]string {
	t.Helper()
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	roles, err := mgr.ListRoles(context.Background(), w.result.DraftID, mwanachamaagency.RoleFilter{})
	if err != nil {
		t.Fatalf("ListRoles: %v", err)
	}
	nameOf := map[string]string{}
	for _, r := range roles {
		nameOf[r.ID] = r.Name
	}
	out := map[string]string{}
	for _, s := range w.draftSteps(t) {
		out[s.Title] = nameOf[s.AccountableRoleID]
	}
	return out
}

func TestImportOfAnOlderFileFoldsItsAccountableEntriesOntoTheSteps(t *testing.T) {
	w := importStepRecordCodes(t, json.RawMessage(olderFileWithRoleAssignments))

	got := w.accountableRoleNamesByStep(t)
	want := map[string]string{"Take the decision": "Lead", "Sign it off": "", "File it": "Lead"}
	for title, role := range want {
		if got[title] != role {
			t.Errorf("the step %q has the accountable role %q, want %q (an entry that repeats the step's own role, and every label but accountable, is dropped)", title, got[title], role)
		}
	}
}

func TestImportReadsTheAccountableRoleOfAStepFromItsOwnField(t *testing.T) {
	var doc map[string]any
	if err := json.Unmarshal([]byte(olderFileWithRoleAssignments), &doc); err != nil {
		t.Fatalf("decode: %v", err)
	}
	delete(doc, "role_assignments")
	steps := doc["work_items"].([]any)
	steps[0].(map[string]any)["accountable_role_id"] = "role-lead"
	steps[2].(map[string]any)["accountable_role_id"] = "role-worker"

	w := importStepRecordCodes(t, importBodyOf(t, doc))

	got := w.accountableRoleNamesByStep(t)
	want := map[string]string{"Take the decision": "Lead", "Sign it off": "", "File it": "Worker"}
	for title, role := range want {
		if got[title] != role {
			t.Errorf("the step %q has the accountable role %q, want %q", title, got[title], role)
		}
	}
}

func TestImportRefusesAnAccountableRoleThatTheFileDoesNotHave(t *testing.T) {
	var doc map[string]any
	if err := json.Unmarshal([]byte(olderFileWithRoleAssignments), &doc); err != nil {
		t.Fatalf("decode: %v", err)
	}
	delete(doc, "role_assignments")
	doc["work_items"].([]any)[0].(map[string]any)["accountable_role_id"] = "role-missing"

	w := newHomeWorld(t)
	rec := w.call(t, "POST", "/instances/import", importBodyOf(t, doc), w.owner)
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode import result: %v (%s)", err, rec.Body.String())
	}
	if len(result.Errors) == 0 {
		t.Errorf("the import named an accountable role the file lacks and reported no error: %s", rec.Body.String())
	}
}

func (w stepRunWalk) fieldPrompts(t *testing.T) map[string]string {
	t.Helper()
	ctx := context.Background()
	m, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		t.Fatalf("drafts: %v", err)
	}
	prompts := map[string]string{}
	for _, id := range append([]string{w.draftID}, drafts...) {
		records, err := m.ListRecords(ctx, id, mwanachamaagency.RecordFilter{})
		if err != nil {
			t.Fatalf("ListRecords: %v", err)
		}
		for _, r := range records {
			for _, q := range r.Questions {
				prompts[q.Key] = q.Prompt
			}
		}
	}
	return prompts
}

func promptKeyed[V any](prompts map[string]string, answers map[string]V) map[string]V {
	out := make(map[string]V, len(answers))
	for name, answer := range answers {
		if prompt, isKey := prompts[name]; isKey {
			name = prompt
		}
		out[name] = answer
	}
	return out
}

func (w stepRunWalk) promptsOfRow(t *testing.T, row agencymodels.RecordRow) map[string]string {
	t.Helper()
	return promptKeyed(w.fieldPrompts(t), row.Answers)
}

func asMap(value any) map[string]any {
	out, _ := value.(map[string]any)
	return out
}
