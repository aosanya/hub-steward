package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func TestAnAddStepWritesARowOfItsRecordAndNoRecordOfItsOwn(t *testing.T) {
	w := newRowStepWalk(t, nil)

	rec := w.send(t, w.people["Coordinator"], "add", map[string]any{"answers": map[string]string{"Tender": "Road survey", "Client": "Ministry"}})
	if rec.Code != http.StatusCreated {
		t.Fatalf("the adding role adds a row: %d %s, want 201", rec.Code, rec.Body.String())
	}
	out := decodeObject(t, rec)
	if out["record_code"] != w.record.Key || out["done"] != true || out["next_step"] != nil {
		t.Errorf("the add answer = %v, want record %s, done, no next step", out, w.record.Key)
	}
	rows := w.rows(t, "")
	if len(rows) != 1 || rows[0].ID != out["row_id"] || w.promptsOfRow(t, rows[0])["Tender"] != "Road survey" || rows[0].OrderID != "" || rows[0].RecordCode != w.record.Key {
		t.Fatalf("the rows of %s = %+v, want the one added row with no order id", w.record.Key, rows)
	}
	records, err := w.manager.ListRecords(t.Context(), w.liveID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	for _, r := range records {
		if strings.HasPrefix(r.Name, "Add a") || strings.HasPrefix(r.Name, "Edit a") || strings.HasPrefix(r.Name, "Delete a") {
			t.Errorf("publishing made the record %q for a generated step", r.Name)
		}
	}
}

func TestAnAddStepAddsSeveralRowsOneAfterAnother(t *testing.T) {
	w := newRowStepWalk(t, nil)
	first, second := w.add(t, w.people["Coordinator"], "Road survey"), w.add(t, w.people["Coordinator"], "Bridge survey")
	if first == second || len(w.rows(t, "")) != 2 {
		t.Fatalf("two adds gave rows %s and %s, listed %d, want two different rows", first, second, len(w.rows(t, "")))
	}
}

func TestAnAddStepIsOpenToTheAddingRoleAndTheOwnerOnly(t *testing.T) {
	w := newRowStepWalk(t, nil)
	body := map[string]any{"answers": map[string]string{"Tender": "Road survey"}}
	if rec := w.send(t, w.people["Volunteer"], "add", body); rec.Code != http.StatusForbidden {
		t.Errorf("Volunteer adds without an add code: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, w.owner, "add", body); rec.Code != http.StatusCreated {
		t.Errorf("the owner adds: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestAnAddStepRefusesAnAnswerTheRecordDoesNotAsk(t *testing.T) {
	w := newRowStepWalk(t, nil)
	rec := w.send(t, w.people["Coordinator"], "add", map[string]any{"answers": map[string]string{"Tender": "Road survey", "Colour": "red"}})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("an answer the record does not ask: %d %s, want 400", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, w.people["Coordinator"], "add", map[string]any{"answers": map[string]string{"Client": "Ministry"}}); rec.Code != http.StatusBadRequest {
		t.Errorf("a missing required answer: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestAnEditStepWritesAReplacingRowThatKeepsTheOrderId(t *testing.T) {
	w := newRowStepWalk(t, nil)
	original := w.seedRow(t, "Road survey", "order-7")

	rec := w.send(t, w.people["Liaison"], "edit", map[string]any{"row_id": original.ID, "answers": map[string]string{"Tender": "Road survey, phase 2"}})
	if rec.Code != http.StatusCreated {
		t.Fatalf("the editing role edits: %d %s, want 201", rec.Code, rec.Body.String())
	}
	out := decodeObject(t, rec)
	if out["row_id"] == original.ID || out["row_id"] == "" || out["done"] != true || out["next_step"] != nil {
		t.Errorf("the edit answer = %v, want a new row id, done, no next step", out)
	}
	current := w.rows(t, "")
	if len(current) != 1 || current[0].ID != out["row_id"] || current[0].Replaces != original.ID || current[0].OrderID != "order-7" || w.promptsOfRow(t, current[0])["Tender"] != "Road survey, phase 2" {
		t.Fatalf("the current rows = %+v, want the replacing row carrying order-7", current)
	}
	history := w.rows(t, "?history=true")
	found := false
	for _, row := range history {
		found = found || row.ID == original.ID
	}
	if !found {
		t.Errorf("history = %+v, want the replaced row in it", history)
	}
}

func TestAnEditStepNeedsACurrentRowOfItsOwnRecord(t *testing.T) {
	w := newRowStepWalk(t, nil)
	original := w.seedRow(t, "Road survey", "")
	body := func(row string) map[string]any {
		return map[string]any{"row_id": row, "answers": map[string]string{"Tender": "Road survey, phase 2"}}
	}
	if rec := w.send(t, w.people["Liaison"], "edit", map[string]any{"answers": map[string]string{"Tender": "x"}}); rec.Code != http.StatusBadRequest {
		t.Errorf("an edit with no row_id: %d %s, want 400", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, w.people["Liaison"], "edit", body("no-such-row")); rec.Code != http.StatusBadRequest {
		t.Errorf("an edit of a row that does not exist: %d %s, want 400", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, w.people["Liaison"], "edit", body(original.ID)); rec.Code != http.StatusCreated {
		t.Fatalf("the first edit: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, w.people["Liaison"], "edit", body(original.ID)); rec.Code < 400 || rec.Code >= 500 {
		t.Errorf("a second edit of the same row: %d %s, want a 4xx refusal", rec.Code, rec.Body.String())
	}
}

func TestAnEditStepRefusesARowOfAnotherRecord(t *testing.T) {
	w := newRowStepWalk(t, nil)
	other, err := w.manager.CreateRecord(t.Context(), agencymodels.Record{
		DraftID: w.draftID, WorkflowID: w.workflow, Name: "Clients", FormName: "Client",
		Questions: []agencymodels.StepQuestion{{Prompt: "Name", AnswerType: agencymodels.AnswerFreeText, Required: true}},
	})
	if err != nil {
		t.Fatalf("CreateRecord: %v", err)
	}
	letRoleAdd(t, w.manager, w.roles["Coordinator"], other)
	w.publish(t)
	foreign, err := w.manager.CreateRecordRow(t.Context(), agencymodels.RecordRow{
		DraftID: w.liveID, RecordID: other.ID, RoleID: w.roles["Coordinator"], AddedBy: "seed", Answers: map[string]string{"Name": "Acme"},
	})
	if err != nil {
		t.Fatalf("seed foreign row: %v", err)
	}
	for _, action := range []string{"edit", "delete"} {
		who, answers := w.people["Liaison"], map[string]string{"Tender": "x"}
		if action == "delete" {
			who, answers = w.people["Volunteer"], map[string]string{"Why is it removed": "wrong"}
		}
		if rec := w.send(t, who, action, map[string]any{"row_id": foreign.ID, "answers": answers}); rec.Code != http.StatusBadRequest {
			t.Errorf("%s of a row of another record: %d %s, want 400", action, rec.Code, rec.Body.String())
		}
	}
	rows, err := w.manager.ListRecordRows(t.Context(), w.liveID, mwanachamaagency.RecordRowFilter{RecordCode: other.Key})
	if err != nil || len(rows) != 1 || rows[0].Deleted {
		t.Errorf("the other record's rows = %+v (%v), want the one row untouched", rows, err)
	}
}

func TestAnEditStepIsOpenToTheEditingRoleNotTheAddingRole(t *testing.T) {
	w := newRowStepWalk(t, nil)
	row := w.seedRow(t, "Road survey", "")
	body := map[string]any{"row_id": row.ID, "answers": map[string]string{"Tender": "Road survey, phase 2"}}
	if rec := w.send(t, w.people["Coordinator"], "edit", body); rec.Code != http.StatusForbidden {
		t.Errorf("the adding role edits though the record names an editing role: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, w.owner, "edit", body); rec.Code != http.StatusCreated {
		t.Errorf("the owner edits: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestAnEditAndADeleteStepNeedTheirOwnCodesNotTheAddingRole(t *testing.T) {
	w := newRowStepWalk(t, nil)
	row := w.seedRow(t, "Road survey", "")
	body := map[string]any{"row_id": row.ID, "answers": map[string]string{"Tender": "Road survey, phase 2"}}
	if rec := w.send(t, w.people["Coordinator"], "edit", body); rec.Code != http.StatusForbidden {
		t.Errorf("the adding role edits with no edit code: %d %s, want 403", rec.Code, rec.Body.String())
	}
	why := map[string]any{"row_id": row.ID, "answers": map[string]string{"Why is it removed": "dropped"}}
	if rec := w.send(t, w.people["Coordinator"], "delete", why); rec.Code != http.StatusForbidden {
		t.Errorf("the adding role deletes with no delete code: %d %s, want 403", rec.Code, rec.Body.String())
	}
}

func TestADeleteStepRetiresTheRowWithItsReasonAndHistoryKeepsIt(t *testing.T) {
	w := newRowStepWalk(t, nil)
	row := w.seedRow(t, "Road survey", "")
	keep := w.seedRow(t, "Bridge survey", "")

	rec := w.send(t, w.people["Volunteer"], "delete", map[string]any{"row_id": row.ID, "answers": map[string]string{"Why is it removed": "Entered twice"}})
	if rec.Code != http.StatusCreated {
		t.Fatalf("the deleting role deletes: %d %s, want 201", rec.Code, rec.Body.String())
	}
	out := decodeObject(t, rec)
	if out["row_id"] != row.ID || out["done"] != true || out["next_step"] != nil {
		t.Errorf("the delete answer = %v, want the retired row's id, done, no next step", out)
	}
	live := w.rows(t, "")
	if len(live) != 1 || live[0].ID != keep.ID {
		t.Errorf("the live rows = %+v, want only %s", live, keep.ID)
	}
	var retired *agencymodels.RecordRow
	for _, r := range w.rows(t, "?history=true") {
		if r.ID == row.ID {
			retired = &r
		}
	}
	if retired == nil || !retired.Deleted || retired.DeletedReason != "Entered twice" || retired.DeletedBy == "" || retired.DeletedOn == "" {
		t.Errorf("history holds %+v, want the retired row with who, why and when", retired)
	}
}

func TestADeleteStepNeedsARowAndAReasonAndTheDeletingRole(t *testing.T) {
	w := newRowStepWalk(t, nil)
	row := w.seedRow(t, "Road survey", "")
	why := map[string]string{"Why is it removed": "Entered twice"}
	if rec := w.send(t, w.people["Volunteer"], "delete", map[string]any{"answers": why}); rec.Code != http.StatusBadRequest {
		t.Errorf("a delete with no row_id: %d %s, want 400", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, w.people["Volunteer"], "delete", map[string]any{"row_id": row.ID, "answers": map[string]string{"Why is it removed": "  "}}); rec.Code != http.StatusBadRequest {
		t.Errorf("a delete with no reason: %d %s, want 400", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, w.people["Coordinator"], "delete", map[string]any{"row_id": row.ID, "answers": why}); rec.Code != http.StatusForbidden {
		t.Errorf("the adding role deletes though the record names a deleting role: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if len(w.rows(t, "")) != 1 {
		t.Fatalf("a refused delete removed the row")
	}
	if rec := w.send(t, w.owner, "delete", map[string]any{"row_id": row.ID, "answers": why}); rec.Code != http.StatusCreated {
		t.Errorf("the owner deletes: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, w.owner, "delete", map[string]any{"row_id": row.ID, "answers": why}); rec.Code != http.StatusBadRequest {
		t.Errorf("a second delete of the same row: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestARetiredRowCannotBeEditedAndAReplacedRowCannotBeDeleted(t *testing.T) {
	w := newRowStepWalk(t, nil)
	retired := w.seedRow(t, "Road survey", "")
	why := map[string]string{"Why is it removed": "Entered twice"}
	if rec := w.send(t, w.people["Volunteer"], "delete", map[string]any{"row_id": retired.ID, "answers": why}); rec.Code != http.StatusCreated {
		t.Fatalf("delete: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, w.people["Liaison"], "edit", map[string]any{"row_id": retired.ID, "answers": map[string]string{"Tender": "again"}}); rec.Code < 400 || rec.Code >= 500 {
		t.Errorf("an edit of a retired row: %d %s, want a 4xx refusal", rec.Code, rec.Body.String())
	}
	replaced := w.seedRow(t, "Bridge survey", "")
	if rec := w.send(t, w.people["Liaison"], "edit", map[string]any{"row_id": replaced.ID, "answers": map[string]string{"Tender": "Bridge survey 2"}}); rec.Code != http.StatusCreated {
		t.Fatalf("edit: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, w.people["Volunteer"], "delete", map[string]any{"row_id": replaced.ID, "answers": why}); rec.Code != http.StatusBadRequest {
		t.Errorf("a delete of a replaced row: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestAGeneratedRunCompletesWhenSentAndNeverWaits(t *testing.T) {
	w := newRowStepWalk(t, nil)
	w.add(t, w.people["Coordinator"], "Road survey")
	for _, who := range []string{"Coordinator", "Liaison", "Volunteer"} {
		for _, item := range w.availableWithGenerated(t, w.people[who]) {
			if item["state"] == stepStateWaiting {
				t.Errorf("%s has a waiting item after a generated run was sent: %v", who, item)
			}
		}
	}
	plain := w.call(t, "GET", "/instances/"+w.instance+"/my-sent-steps", nil, w.people["Coordinator"])
	if plain.Code != http.StatusOK {
		t.Fatalf("my-sent-steps: %d %s", plain.Code, plain.Body.String())
	}
	for _, item := range decodeObjects(t, plain) {
		if item["generated"] == true || strings.HasPrefix(item["workflow_name"].(string), "Add a") {
			t.Errorf("the Done list shows a generated run without asking: %v", item)
		}
	}
}

func TestTheSentListShowsGeneratedRunsOnlyWhenAskedWithIncludeGenerated(t *testing.T) {
	w := newRowStepWalk(t, nil)
	added := w.add(t, w.people["Coordinator"], "Road survey")
	edited := w.send(t, w.people["Liaison"], "edit", map[string]any{"row_id": added, "answers": map[string]string{"Tender": "Road survey 2"}})
	if edited.Code != http.StatusCreated {
		t.Fatalf("edit: %d %s", edited.Code, edited.Body.String())
	}
	removeMe := w.seedRow(t, "Bridge survey", "")
	if rec := w.send(t, w.people["Volunteer"], "delete", map[string]any{"row_id": removeMe.ID, "answers": map[string]string{"Why is it removed": "gone"}}); rec.Code != http.StatusCreated {
		t.Fatalf("delete: %d %s", rec.Code, rec.Body.String())
	}
	base := "/instances/" + w.instance + "/my-sent-steps"
	sentTitles := func(as string, query string) []string {
		rec := w.call(t, "GET", base+query, nil, w.people[as])
		if rec.Code != http.StatusOK {
			t.Fatalf("my-sent-steps%s: %d %s", query, rec.Code, rec.Body.String())
		}
		return titles(decodeObjects(t, rec))
	}
	if got := sentTitles("Coordinator", ""); len(got) != 0 {
		t.Errorf("the Done list without include_generated shows %v, want nothing", got)
	}
	if got := sentTitles("Coordinator", "?include_generated=true"); !sameTitles(got, []string{"Add a tender"}) {
		t.Errorf("the Coordinator's Done list with include_generated shows %v, want [Add a tender]", got)
	}
	if got := sentTitles("Liaison", "?include_generated=true"); !sameTitles(got, []string{"Edit a tender"}) {
		t.Errorf("the Liaison's Done list with include_generated shows %v, want [Edit a tender]", got)
	}
	if got := sentTitles("Volunteer", "?include_generated=true"); !sameTitles(got, []string{"Delete a tender"}) {
		t.Errorf("the Volunteer's Done list with include_generated shows %v, want [Delete a tender]", got)
	}
}

func TestTheSentToolTakesIncludeGeneratedToo(t *testing.T) {
	w := newRowStepWalk(t, nil)
	w.add(t, w.people["Coordinator"], "Road survey")
	caller := designAgentWalk{stepRunWalk: w.stepRunWalk}
	args := func(extra map[string]any) map[string]any {
		out := map[string]any{"instance_id": w.instance}
		for k, v := range extra {
			out[k] = v
		}
		return out
	}
	itemsOf := func(extra map[string]any) []any {
		out := caller.mcpCall(t, w.subjects["Coordinator"], callerSentStepsTool, args(extra))
		if out.IsError {
			t.Fatalf("%s: %s", callerSentStepsTool, toolErrorText(out))
		}
		body, _ := out.StructuredContent.(map[string]any)
		items, _ := body["items"].([]any)
		return items
	}
	if got := itemsOf(nil); len(got) != 0 {
		t.Errorf("the tool without include_generated shows %v, want nothing", got)
	}
	got := itemsOf(map[string]any{"include_generated": true})
	if len(got) != 1 {
		t.Fatalf("the tool with include_generated shows %v, want the one added row", got)
	}
	if item, _ := got[0].(map[string]any); item["generated"] != true || item["record_code"] != w.record.Key {
		t.Errorf("the generated item = %v, want generated true of %s", item, w.record.Key)
	}
}

func TestTheStartListMarksGeneratedWorkflowsAndTheirStandIns(t *testing.T) {
	w := newRowStepWalk(t, nil)
	for who, want := range map[string][2]string{"Coordinator": {"Add a tender", "add"}, "Liaison": {"Edit a tender", "edit"}, "Volunteer": {"Delete a tender", "delete"}} {
		var item map[string]any
		for _, candidate := range w.availableWithGenerated(t, w.people[who]) {
			if candidate["title"] == want[0] {
				item = candidate
			}
		}
		if item == nil {
			t.Fatalf("the %s's start list does not hold %q", who, want[0])
		}
		if item["generated"] != true || item["row_action"] != want[1] || item["record_code"] != w.record.Key || item["state"] != stepStateStart {
			t.Errorf("%q = %v, want generated, row_action %s, record %s, state start", want[0], item, want[1], w.record.Key)
		}
	}
	for _, item := range w.availableWithGenerated(t, w.people["Volunteer"]) {
		if item["title"] == "Report a referral" && item["generated"] == true {
			t.Errorf("the designed step %v is marked generated", item)
		}
	}
}

func TestAStartListMarksAGeneratedWorkflowThatADesignedOneReplaces(t *testing.T) {
	w := newRowStepWalk(t, func(w stepRunWalk, r *agencymodels.Record) { r.AddReplacedBy = "W-1" })
	var add map[string]any
	for _, item := range w.availableWithGenerated(t, w.people["Coordinator"]) {
		if item["title"] == "Add a tender" {
			add = item
		}
	}
	if add == nil || add["replaced_by"] != "W-1" || add["generated"] != true {
		t.Errorf("the Add a tender item = %v, want generated with replaced_by W-1", add)
	}
	if rec := w.send(t, w.people["Coordinator"], "add", map[string]any{"answers": map[string]string{"Tender": "Road survey"}}); rec.Code != http.StatusCreated {
		t.Errorf("a generated workflow that a designed one replaces still runs: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestThePlainOpenStepsMarkGeneratedStepsToo(t *testing.T) {
	w := newRowStepWalk(t, nil)
	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-open-steps", nil, w.people["Coordinator"])
	if rec.Code != http.StatusOK {
		t.Fatalf("my-open-steps: %d %s", rec.Code, rec.Body.String())
	}
	for _, item := range decodeObjects(t, rec) {
		if item["title"] == "Add a tender" && item["generated"] != true {
			t.Errorf("the plain list carries %v for the generated Add, want generated true", item)
		}
	}
}

func TestARetiredRowLeavesTheLiveListAndTheHistoryReadKeepsIt(t *testing.T) {
	w := newRowStepWalk(t, nil)
	row := w.seedRow(t, "Road survey", "")
	if _, err := w.manager.RetireRecordRow(t.Context(), row.ID, "someone", "Entered twice"); err != nil {
		t.Fatalf("RetireRecordRow: %v", err)
	}
	if live := w.rows(t, ""); len(live) != 0 {
		t.Errorf("the live list = %+v, want the retired row hidden", live)
	}
	history := w.rows(t, "?history=true")
	if len(history) != 1 || history[0].ID != row.ID || history[0].DeletedReason != "Entered twice" {
		t.Errorf("the history read = %+v, want the retired row with its reason", history)
	}
}

func (w rowStepWalk) wantNamedRefusal(t *testing.T, who string, rec *httptest.ResponseRecorder, sentence, workflow, workflowCode, action string) {
	t.Helper()
	if rec.Code != http.StatusForbidden {
		t.Errorf("%s: %d %s, want 403", who, rec.Code, rec.Body.String())
		return
	}
	got := decodeObject(t, rec)
	want := map[string]any{"error": sentence, "workflow": workflow, "workflow_code": workflowCode, "action": action}
	for field, value := range want {
		if got[field] != value {
			t.Errorf("%s: %s = %v, want %q (body %s)", who, field, got[field], value, rec.Body.String())
		}
	}
	if sentence, _ := got["error"].(string); strings.Contains(sentence, w.record.Key) {
		t.Errorf("%s: the sentence %q still names the record code %s", who, sentence, w.record.Key)
	}
}

func TestTheDirectAddRouteIsRefusedToResidentsAndAgentsAndNamesTheWorkflowTheyStart(t *testing.T) {
	w := newRowStepWalk(t, nil)
	path := "/instances/" + w.instance + "/live-records/" + w.record.Key + "/rows"
	body := map[string]any{"answers": map[string]string{"Tender": "Road survey"}}
	sentence := "Use Add a tender to add a tender"
	code := w.record.Key + ".add"
	rec := w.call(t, "POST", path, body, w.people["Coordinator"])
	w.wantNamedRefusal(t, "a resident who holds the adding role posts to the direct route", rec, sentence, "Add a tender", code, "add")
	agent := w.agentWith(t, "agent-adder", "Coordinator")
	rec = w.call(t, "POST", path, body, agent)
	w.wantNamedRefusal(t, "an agent who holds the adding role posts to the direct route", rec, sentence, "Add a tender", code, "add")
	if rec := w.call(t, "POST", path, body, w.owner); rec.Code != http.StatusCreated {
		t.Errorf("the platform owner posts to the direct route: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if len(w.rows(t, "")) != 1 {
		t.Errorf("rows after the refused and the allowed posts = %d, want 1", len(w.rows(t, "")))
	}
}

func TestTheDirectRouteRefusesACorrectionAndNamesTheEditWorkflow(t *testing.T) {
	w := newRowStepWalk(t, nil)
	row := w.seedRow(t, "Road survey", "")
	path := "/instances/" + w.instance + "/live-records/" + w.record.Key + "/rows"
	body := map[string]any{"answers": map[string]string{"Tender": "Road survey, revised"}, "replaces": row.ID}
	sentence := "Use Edit a tender to edit a tender"
	code := w.record.Key + ".edit"
	rec := w.call(t, "POST", path, body, w.people["Liaison"])
	w.wantNamedRefusal(t, "a resident corrects a row through the direct route", rec, sentence, "Edit a tender", code, "edit")
	rec = w.call(t, "POST", path, body, w.agentWith(t, "agent-editor", "Liaison"))
	w.wantNamedRefusal(t, "an agent corrects a row through the direct route", rec, sentence, "Edit a tender", code, "edit")
	if len(w.rows(t, "")) != 1 {
		t.Errorf("rows after the refused corrections = %d, want the one seeded row", len(w.rows(t, "")))
	}
}

func TestTheDirectAddToolIsRefusedToResidentsAndAgentsAndAllowedToTheOwner(t *testing.T) {
	w := newRowStepWalk(t, nil)
	w.agentWith(t, "agent-tool", "Coordinator")
	caller := designAgentWalk{stepRunWalk: w.stepRunWalk}
	args := map[string]any{"instance_id": w.instance, "record_code": w.record.Key, "answers": map[string]string{"Tender": "Road survey"}}
	for _, subject := range []string{"agent-tool", w.subjects["Coordinator"]} {
		out := caller.mcpCall(t, subject, addLiveRecordRowTool, args)
		if !out.IsError || !strings.Contains(toolErrorText(out), "Use Add a tender to add a tender") || strings.Contains(toolErrorText(out), w.record.Key) {
			t.Errorf("%s adds through the tool: error %v %q, want a refusal that says Use Add a tender to add a tender and leaves out %s", subject, out.IsError, toolErrorText(out), w.record.Key)
		}
	}
	if out := caller.mcpCall(t, "test-owner", addLiveRecordRowTool, args); out.IsError {
		t.Errorf("the owner adds through the tool: %s", toolErrorText(out))
	}
}

func TestTheDirectAddToolRefusesACorrectionAndNamesTheEditWorkflow(t *testing.T) {
	w := newRowStepWalk(t, nil)
	row := w.seedRow(t, "Road survey", "")
	w.agentWith(t, "agent-tool", "Liaison")
	caller := designAgentWalk{stepRunWalk: w.stepRunWalk}
	args := map[string]any{"instance_id": w.instance, "record_code": w.record.Key, "answers": map[string]string{"Tender": "Road survey, revised"}, "replaces": row.ID}
	out := caller.mcpCall(t, "agent-tool", addLiveRecordRowTool, args)
	if !out.IsError || !strings.Contains(toolErrorText(out), "Use Edit a tender to edit a tender") {
		t.Errorf("an agent corrects a row through the tool: error %v %q, want Use Edit a tender to edit a tender", out.IsError, toolErrorText(out))
	}
}

func TestTheAgencyDesignSurfaceStaysClosedToResidentsAndAgentsForRows(t *testing.T) {
	w := newRowStepWalk(t, nil)
	row := w.seedRow(t, "Road survey", "")
	base := "/instances/" + w.instance
	agent := w.agentWith(t, "agent-design", "Volunteer")
	for name, as := range map[string]*http.Cookie{"resident": w.people["Volunteer"], "agent": agent} {
		rec := w.call(t, "POST", base+"/record-rows/"+row.ID+"/retire", map[string]any{"reason": "gone"}, as)
		if rec.Code != http.StatusForbidden && rec.Code != http.StatusNotFound {
			t.Errorf("a %s retires a row through the design route: %d %s, want 403 or 404", name, rec.Code, rec.Body.String())
		}
		rec = w.call(t, "POST", base+"/record-rows", map[string]any{"draft_id": w.liveID, "record_id": w.record.ID, "role_id": w.roles["Coordinator"], "answers": map[string]string{"Tender": "Bridge"}}, as)
		if rec.Code != http.StatusForbidden && rec.Code != http.StatusNotFound {
			t.Errorf("a %s adds a row through the design route: %d %s, want 403 or 404", name, rec.Code, rec.Body.String())
		}
	}
	if live := w.rows(t, ""); len(live) != 1 || live[0].Deleted {
		t.Errorf("the rows after the refused design calls = %+v, want the one untouched row", live)
	}
}

func TestTwoAddsNeverShareASendKeyUnlessTheClientRepeatsIt(t *testing.T) {
	w := newRowStepWalk(t, nil)
	as := w.people["Coordinator"]
	for _, tender := range []string{"Road survey", "Bridge survey", "Culvert survey"} {
		if rec := w.send(t, as, "add", map[string]any{"answers": map[string]string{"Tender": tender}}); rec.Code != http.StatusCreated {
			t.Fatalf("add %s: %d %s", tender, rec.Code, rec.Body.String())
		}
	}
	keyed := map[string]any{"send_key": "k-1", "answers": map[string]string{"Tender": "Dam survey"}}
	if rec := w.send(t, as, "add", keyed); rec.Code != http.StatusCreated {
		t.Fatalf("a keyed add: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, as, "add", keyed); rec.Code != http.StatusConflict {
		t.Errorf("the same keyed add sent again: %d %s, want 409 already sent", rec.Code, rec.Body.String())
	}
	if len(w.rows(t, "")) != 4 {
		t.Errorf("rows = %d, want 4", len(w.rows(t, "")))
	}
}

func TestARowStepTakesNoOrderIdAndAnAddTakesNoRowId(t *testing.T) {
	w := newRowStepWalk(t, nil)
	as := w.people["Coordinator"]
	if rec := w.send(t, as, "add", map[string]any{"order_id": "run-1", "answers": map[string]string{"Tender": "x"}}); rec.Code != http.StatusBadRequest {
		t.Errorf("an add with an order_id: %d %s, want 400", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, as, "add", map[string]any{"row_id": "r-1", "answers": map[string]string{"Tender": "x"}}); rec.Code != http.StatusBadRequest {
		t.Errorf("an add with a row_id: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestTheStepToolTakesARowIdForEditAndDelete(t *testing.T) {
	w := newRowStepWalk(t, nil)
	row := w.seedRow(t, "Road survey", "")
	caller := designAgentWalk{stepRunWalk: w.stepRunWalk}
	edit := caller.mcpCall(t, w.subjects["Liaison"], submitStepAnswersTool, map[string]any{
		"instance_id": w.instance, "step_id": w.generatedStepID(t, "edit"), "row_id": row.ID, "answers": map[string]string{"Tender": "Road survey 2"},
	})
	if edit.IsError {
		t.Fatalf("the tool edits a row: %s", toolErrorText(edit))
	}
	body, _ := edit.StructuredContent.(map[string]any)
	next, _ := body["row_id"].(string)
	if next == "" || next == row.ID {
		t.Fatalf("the tool's edit answer = %v, want the replacing row's id", body)
	}
	del := caller.mcpCall(t, w.subjects["Volunteer"], submitStepAnswersTool, map[string]any{
		"instance_id": w.instance, "step_id": w.generatedStepID(t, "delete"), "row_id": next, "answers": map[string]string{"Why is it removed": "Entered twice"},
	})
	if del.IsError {
		t.Fatalf("the tool deletes a row: %s", toolErrorText(del))
	}
	if live := w.rows(t, ""); len(live) != 0 {
		t.Errorf("the live rows after the tool's delete = %+v, want none", live)
	}
}

func TestDeletingAnEditedRowDoesNotBringTheOlderVersionBack(t *testing.T) {
	w := newRowStepWalk(t, nil)
	original := w.seedRow(t, "Road survey", "")
	edited := w.send(t, w.people["Liaison"], "edit", map[string]any{"row_id": original.ID, "answers": map[string]string{"Tender": "Road survey 2"}})
	if edited.Code != http.StatusCreated {
		t.Fatalf("edit: %d %s", edited.Code, edited.Body.String())
	}
	current, _ := decodeObject(t, edited)["row_id"].(string)
	if rec := w.send(t, w.people["Volunteer"], "delete", map[string]any{"row_id": current, "answers": map[string]string{"Why is it removed": "Entered twice"}}); rec.Code != http.StatusCreated {
		t.Fatalf("delete: %d %s", rec.Code, rec.Body.String())
	}
	if live := w.rows(t, ""); len(live) != 0 {
		t.Errorf("the live rows = %+v, want none: the older version is history", live)
	}
	if rec := w.send(t, w.people["Volunteer"], "delete", map[string]any{"row_id": original.ID, "answers": map[string]string{"Why is it removed": "again"}}); rec.Code != http.StatusBadRequest {
		t.Errorf("a delete of the older version: %d %s, want 400", rec.Code, rec.Body.String())
	}
}
