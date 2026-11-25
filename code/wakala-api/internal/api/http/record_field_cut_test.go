package http

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type fieldCutWalk struct {
	reachWalk
	everyRow string
}

type fieldCutRecord struct {
	Key       string                      `json:"key"`
	Questions []agencymodels.StepQuestion `json:"questions"`
	AddFields []string                    `json:"add_fields"`
	CanAdd    bool                        `json:"can_add_rows"`
}

func fieldCutQuestions() []agencymodels.StepQuestion {
	return []agencymodels.StepQuestion{
		{Prompt: "Tender", AnswerType: agencymodels.AnswerFreeText, Required: true},
		{Prompt: "Client", AnswerType: agencymodels.AnswerFreeText},
		{Prompt: "Estimated value", AnswerType: agencymodels.AnswerFreeText},
		{Prompt: "Lead", AnswerType: agencymodels.AnswerSingleChoice, OptionsFrom: "members"},
	}
}

func codeOfPrompt(record agencymodels.Record, prompt string) string {
	at := slices.IndexFunc(record.Questions, func(q agencymodels.StepQuestion) bool { return q.Prompt == prompt })
	return record.Questions[at].Code
}

func viewOf(record agencymodels.Record, prompt string) string {
	return mwanachamaagency.RecordPermissionCode(record.Code, mwanachamaagency.RecordViewAction, codeOfPrompt(record, prompt))
}

func addOf(record agencymodels.Record, prompt string) string {
	return mwanachamaagency.RecordPermissionCode(record.Code, agencymodels.RowActionAdd, codeOfPrompt(record, prompt))
}

func fieldCutGrants(record agencymodels.Record) map[string][]string {
	star := func(action string) string {
		return mwanachamaagency.RecordPermissionCode(record.Code, action, mwanachamaagency.RecordFieldStar)
	}
	return map[string][]string{
		"Coordinator": {star(agencymodels.RowActionAdd), viewOf(record, "Tender"), viewOf(record, "Client")},
		"Liaison":     {star(mwanachamaagency.RecordViewAction)},
		"Volunteer":   {addOf(record, "Estimated value"), viewOf(record, "Lead")},
	}
}

func newFieldCutWalk(t *testing.T) fieldCutWalk {
	t.Helper()
	shape := func(_ stepRunWalk, r *agencymodels.Record) { r.Questions = fieldCutQuestions() }
	w := reachWalk{rowStepWalk: newRowStepWalkGranting(t, shape, fieldCutGrants)}
	return fieldCutWalk{reachWalk: w, everyRow: w.groupCarrying(t, "Everything", "all")}
}

func (w fieldCutWalk) seedFull(t *testing.T, addedBy, replaces string) agencymodels.RecordRow {
	t.Helper()
	row, err := w.manager.CreateRecordRow(context.Background(), agencymodels.RecordRow{
		DraftID: w.liveID, RecordID: w.record.ID, RoleID: addingRoleOf(t, w.manager, w.liveID, w.record), AddedBy: addedBy,
		Answers:   map[string]string{"Tender": "Road survey" + replaces, "Client": "Ministry", "Estimated value": "900000", "Lead": "person-1"},
		PlaceRefs: map[string]string{"Client": "address:1", "Estimated value": "address:2"},
		Replaces:  replaces, Tags: []string{w.tagID(t, "all")},
	})
	if err != nil {
		t.Fatalf("seed full row: %v", err)
	}
	return row
}

func (w fieldCutWalk) rowsFor(t *testing.T, as *http.Cookie, query string) []agencymodels.RecordRow {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/live-records/"+w.record.Key+"/rows"+query, nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("list rows: %d %s, want 200", rec.Code, rec.Body.String())
	}
	var rows []agencymodels.RecordRow
	decodeInto(t, rec, &rows)
	return rows
}

func (w fieldCutWalk) keysOf(row agencymodels.RecordRow) []string {
	keys := []string{}
	for key := range row.Answers {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}

func (w fieldCutWalk) refsOf(row agencymodels.RecordRow) []string {
	keys := []string{}
	for key := range row.PlaceRefs {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}

func (w fieldCutWalk) prompts(t *testing.T, keys []string) []string {
	t.Helper()
	known := w.fieldPrompts(t)
	out := []string{}
	for _, key := range keys {
		if prompt, ok := known[key]; ok {
			key = prompt
		}
		out = append(out, key)
	}
	slices.Sort(out)
	return out
}

func (w fieldCutWalk) search(t *testing.T, subject string, args map[string]any) (int, string) {
	t.Helper()
	args["instance_id"] = w.instance
	args["record_code"] = w.record.Code
	out := designAgentWalk{stepRunWalk: w.stepRunWalk}.mcpCall(t, subject, listLiveRecordRowsTool, args)
	if out.IsError {
		return 0, toolErrorText(out)
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	var body struct {
		Items []agencymodels.RecordRow `json:"items"`
	}
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatalf("structured content %s: %v", encoded, err)
	}
	return len(body.Items), ""
}

func TestTheRowListCutsAnswersAndPlaceRefsToTheFieldsTheCallerHoldsViewFor(t *testing.T) {
	w := newFieldCutWalk(t)
	w.seedFull(t, "someone-else", "")
	viewer := w.callerIn(t, "viewer", "Coordinator", w.everyRow)

	rows := w.rowsFor(t, viewer, "")
	if len(rows) != 1 {
		t.Fatalf("the viewer lists %d rows, want 1", len(rows))
	}
	if got := w.prompts(t, w.keysOf(rows[0])); !slices.Equal(got, []string{"Client", "Tender"}) {
		t.Errorf("answers carry %v, want Client and Tender only", got)
	}
	if got := w.prompts(t, w.refsOf(rows[0])); !slices.Equal(got, []string{"Client"}) {
		t.Errorf("place_refs carry %v, want Client only", got)
	}
}

func TestTheRowListCutsTheCallersOwnRowsToo(t *testing.T) {
	w := newFieldCutWalk(t)
	w.seedFull(t, "viewer", "")
	viewer := w.callerIn(t, "viewer", "Coordinator", w.everyRow)

	rows := w.rowsFor(t, viewer, "")
	if len(rows) != 1 {
		t.Fatalf("the viewer lists %d rows, want 1", len(rows))
	}
	if got := w.prompts(t, w.keysOf(rows[0])); !slices.Equal(got, []string{"Client", "Tender"}) {
		t.Errorf("a row the caller added carries %v, want Client and Tender only", got)
	}
}

func TestTheRowListKeepsEveryFieldForACallerHoldingViewStar(t *testing.T) {
	w := newFieldCutWalk(t)
	w.seedFull(t, "someone-else", "")
	full := w.callerIn(t, "full", "Liaison", w.everyRow)

	rows := w.rowsFor(t, full, "")
	if len(rows) != 1 {
		t.Fatalf("the caller lists %d rows, want 1", len(rows))
	}
	if got := w.prompts(t, w.keysOf(rows[0])); !slices.Equal(got, []string{"Client", "Estimated value", "Lead", "Tender"}) {
		t.Errorf("answers carry %v, want every field", got)
	}
	if got := w.prompts(t, w.refsOf(rows[0])); !slices.Equal(got, []string{"Client", "Estimated value"}) {
		t.Errorf("place_refs carry %v, want both", got)
	}
}

func TestTheHistoryOfARowIsCutLikeTheRowList(t *testing.T) {
	w := newFieldCutWalk(t)
	first := w.seedFull(t, "viewer", "")
	w.seedFull(t, "viewer", first.ID)
	viewer := w.callerIn(t, "viewer", "Coordinator", w.everyRow)

	history := w.rowsFor(t, viewer, "?history=true")
	if len(history) != 1 {
		t.Fatalf("the history holds %d rows, want 1", len(history))
	}
	if got := w.prompts(t, w.keysOf(history[0])); !slices.Equal(got, []string{"Client", "Tender"}) {
		t.Errorf("the history carries %v, want Client and Tender only", got)
	}
	if got := w.prompts(t, w.refsOf(history[0])); !slices.Equal(got, []string{"Client"}) {
		t.Errorf("the history place_refs carry %v, want Client only", got)
	}
}

func TestAWhereOnAHiddenFieldIsRefusedNamingTheFieldAndOnAViewableFieldWorks(t *testing.T) {
	w := newFieldCutWalk(t)
	w.seedFull(t, "someone-else", "")
	w.callerIn(t, "viewer", "Coordinator", w.everyRow)

	hidden := []map[string]string{{"question": "Estimated value", "operator": "is", "value": "900000"}}
	if count, why := w.search(t, "viewer", map[string]any{"where": hidden}); why == "" || !strings.Contains(why, "Estimated value") {
		t.Errorf("a where on a hidden field gave %d rows and %q, want a refusal naming Estimated value", count, why)
	}
	if count, why := w.search(t, "viewer", map[string]any{"where": []map[string]string{{"question": "Client", "operator": "is", "value": "Ministry"}}}); why != "" || count != 1 {
		t.Errorf("a where on a viewable field gave %d rows and %q, want 1 row", count, why)
	}
}

func TestAnAnswerActorFilterOnAHiddenPersonFieldIsRefused(t *testing.T) {
	w := newFieldCutWalk(t)
	w.seedFull(t, "someone-else", "")
	w.callerIn(t, "viewer", "Coordinator", w.everyRow)
	w.callerIn(t, "full", "Liaison", w.everyRow)

	if count, why := w.search(t, "viewer", map[string]any{"answer_actor_id": "person-1"}); why == "" || !strings.Contains(why, "Lead") {
		t.Errorf("answer_actor_id on a hidden field gave %d rows and %q, want a refusal naming Lead", count, why)
	}
	if count, why := w.search(t, "full", map[string]any{"answer_actor_id": "person-1"}); why != "" || count != 1 {
		t.Errorf("answer_actor_id on a viewable field gave %d rows and %q, want 1 row", count, why)
	}
}

func TestTheRecordListCutsItsQuestionsToTheFieldsHeldForViewOrAddAndListsTheAddableOnes(t *testing.T) {
	w := newFieldCutWalk(t)
	doctor := w.callerIn(t, "doctor", "Volunteer", w.everyRow)

	rec := w.call(t, "GET", "/instances/"+w.instance+"/live-records", nil, doctor)
	if rec.Code != http.StatusOK {
		t.Fatalf("list records: %d %s, want 200", rec.Code, rec.Body.String())
	}
	var records []fieldCutRecord
	decodeInto(t, rec, &records)
	at := slices.IndexFunc(records, func(r fieldCutRecord) bool {
		return r.Key == w.record.Key
	})
	if at < 0 {
		t.Fatalf("the record %s is not listed: %s", w.record.Key, rec.Body.String())
	}
	got := []string{}
	for _, q := range records[at].Questions {
		got = append(got, q.Prompt)
	}
	slices.Sort(got)
	if !slices.Equal(got, []string{"Estimated value", "Lead"}) {
		t.Errorf("the questions are %v, want Estimated value and Lead", got)
	}
	if !slices.Equal(records[at].AddFields, []string{codeOfPrompt(w.record, "Estimated value")}) {
		t.Errorf("add_fields is %v, want the Estimated value code", records[at].AddFields)
	}
	if !records[at].CanAdd {
		t.Errorf("can_add_rows is false, want true as before")
	}
}

func TestTheRecordListHidesEveryQuestionFromACallerHoldingNeitherViewNorAdd(t *testing.T) {
	w := newFieldCutWalk(t)
	w.holdingOnly("Volunteer")
	bare := w.callerIn(t, "bare", "Volunteer", w.everyRow)

	rec := w.call(t, "GET", "/instances/"+w.instance+"/live-records", nil, bare)
	if rec.Code != http.StatusOK {
		t.Fatalf("list records: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "Estimated value") || strings.Contains(rec.Body.String(), "Client") {
		t.Errorf("a caller with no view or add sees field names: %s", rec.Body.String())
	}
}
