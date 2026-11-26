package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type settingWalk struct {
	subjectWalk
}

func stageQuestion() agencymodels.StepQuestion {
	return agencymodels.StepQuestion{Prompt: "Stage", AnswerType: agencymodels.AnswerSingleChoice, Required: true, Options: []string{"Open", "Far", "Arrived"}}
}

func newSettingWalk(t *testing.T) settingWalk {
	t.Helper()
	w := newStepRunWalk(t, referralPlan(), "Volunteer", "Liaison", "Coordinator")
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	tenders, err := mgr.CreateRecord(ctx, agencymodels.Record{
		DraftID: w.draftID, WorkflowID: w.workflow, Name: "Tenders", ItemName: "Tender",
		FormName: "Tender", Questions: append(tenderQuestions(), stageQuestion()),
	})
	if err != nil {
		t.Fatalf("CreateRecord Tenders: %v", err)
	}
	letRoleAdd(t, mgr, w.roles["Coordinator"], tenders)
	workflow, err := mgr.GetWorkflow(ctx, w.workflow)
	if err != nil {
		t.Fatalf("GetWorkflow: %v", err)
	}
	workflow.SubjectRecord = tenders.Key
	if _, err := mgr.UpdateWorkflow(ctx, workflow); err != nil {
		t.Fatalf("UpdateWorkflow: %v", err)
	}
	settings := map[string][]agencymodels.SubjectSetting{
		"Report a referral": {{When: agencymodels.RouteRule{Question: "Minutes to the clinic", Operator: agencymodels.RouteMoreThan, Value: "10"}, Field: "Stage", To: "Far"}},
		"Confirm arrival":   {{When: agencymodels.RouteRule{Question: "Arrived", Operator: agencymodels.RouteIs, Value: "yes"}, Field: "Stage", To: "Arrived"}},
	}
	for title, set := range settings {
		step, err := mgr.GetWorkItem(ctx, w.steps[title])
		if err != nil {
			t.Fatalf("GetWorkItem %s: %v", title, err)
		}
		step.SetsSubject = set
		if _, err := mgr.UpdateWorkItem(ctx, step); err != nil {
			t.Fatalf("UpdateWorkItem %s: %v", title, err)
		}
	}
	w.publish(t)
	live, err := liveDraftOf(ctx, mgr)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	return settingWalk{subjectWalk{stepRunWalk: w, manager: mgr, liveID: live, tenders: tenders}}
}

func (w settingWalk) tenderRows(t *testing.T) (current []agencymodels.RecordRow, every int) {
	t.Helper()
	ctx := context.Background()
	drafts, err := draftsOfEveryPublication(ctx, w.manager)
	if err != nil {
		t.Fatalf("draftsOfEveryPublication: %v", err)
	}
	current, err = currentRowsOfRecord(ctx, w.manager, drafts, w.tenders.Key)
	if err != nil {
		t.Fatalf("currentRowsOfRecord: %v", err)
	}
	for _, id := range drafts {
		rows, err := w.manager.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{RecordCode: w.tenders.Key, IncludeRetired: true})
		if err != nil {
			t.Fatalf("ListRecordRows: %v", err)
		}
		every += len(rows)
	}
	return current, every
}

func (w settingWalk) stageOf(t *testing.T, row agencymodels.RecordRow) string {
	t.Helper()
	record, err := liveRecordByCode(context.Background(), w.manager, w.liveID, w.tenders.Key)
	if err != nil {
		t.Fatalf("liveRecordByCode: %v", err)
	}
	q, _ := questionNamed(record.Questions, "Stage")
	return answerOf(row.Answers, q)
}

func (w settingWalk) startOn(t *testing.T, tender, minutes string) (string, map[string]any) {
	t.Helper()
	sent := w.start(t, map[string]any{"answers": map[string]string{"Reason": "Fever", "Minutes to the clinic": minutes}, "row_id": tender})
	if sent.Code != http.StatusCreated {
		t.Fatalf("start: %d %s", sent.Code, sent.Body.String())
	}
	out := decodeObject(t, sent)
	order, _ := out["order_id"].(string)
	return order, out
}

func TestASentStepSetsTheChoiceOfItsSubjectRowWhenItsRuleHolds(t *testing.T) {
	w := newSettingWalk(t)
	tender := w.seedRow(t, w.tenders, map[string]string{"Tender": "Road survey", "Stage": "Open"})

	order, started := w.startOn(t, tender, "20")
	current, _ := w.tenderRows(t)
	if len(current) != 1 || w.stageOf(t, current[0]) != "Far" || current[0].Replaces != tender {
		t.Fatalf("after the start the current tender rows = %+v, want one row replacing %s with Stage Far", current, tender)
	}
	if started["subject_row_id"] != current[0].ID {
		t.Errorf("the start reply's subject_row_id = %v, want %s", started["subject_row_id"], current[0].ID)
	}

	arrived := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "Yes"}, order)
	if arrived.Code != http.StatusCreated {
		t.Fatalf("the liaison, who may not edit tenders, confirms: %d %s", arrived.Code, arrived.Body.String())
	}
	current, _ = w.tenderRows(t)
	if len(current) != 1 || w.stageOf(t, current[0]) != "Arrived" {
		t.Fatalf("after the liaison the current tender rows = %+v, want one row with Stage Arrived", current)
	}
	if !strings.Contains(strings.Join(valuesOf(current[0].Answers), "|"), "Road survey") {
		t.Errorf("the replacing row lost the tender's other answers: %+v", current[0].Answers)
	}
	if got := decodeObject(t, arrived)["subject_row_id"]; got != current[0].ID {
		t.Errorf("the liaison's reply subject_row_id = %v, want %s", got, current[0].ID)
	}
}

func TestARuleThatDoesNotHoldLeavesTheSubjectRowAsItIs(t *testing.T) {
	w := newSettingWalk(t)
	tender := w.seedRow(t, w.tenders, map[string]string{"Tender": "Road survey", "Stage": "Open"})

	order, started := w.startOn(t, tender, "5")
	arrived := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "No"}, order)
	if arrived.Code != http.StatusCreated {
		t.Fatalf("the liaison confirms: %d %s", arrived.Code, arrived.Body.String())
	}
	current, every := w.tenderRows(t)
	if len(current) != 1 || current[0].ID != tender || w.stageOf(t, current[0]) != "Open" || every != 1 {
		t.Errorf("the tender rows = %+v (%d in all), want the seeded row alone with Stage Open", current, every)
	}
	if _, set := started["subject_row_id"]; set {
		t.Errorf("a start that set nothing carries subject_row_id: %v", started)
	}
}

func TestASendThatWouldSetTheChoiceOfARemovedRowIsRefusedAndWritesNothing(t *testing.T) {
	w := newSettingWalk(t)
	tender := w.seedRow(t, w.tenders, map[string]string{"Tender": "Road survey", "Stage": "Open"})
	order, _ := w.startOn(t, tender, "5")
	if _, err := w.manager.RetireRecordRow(context.Background(), tender, "seed", "Withdrawn"); err != nil {
		t.Fatalf("RetireRecordRow: %v", err)
	}

	arrived := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "Yes"}, order)
	if arrived.Code != http.StatusConflict {
		t.Fatalf("the liaison confirms on a removed tender: %d %s, want 409", arrived.Code, arrived.Body.String())
	}
	liaison := w.available(t, w.people["Liaison"])
	if len(liaison) != 1 || liaison[0]["order_id"] != order {
		t.Errorf("the refused step is no longer waiting: %v", liaison)
	}
}

const settingAgency = `{
  "name": "Setting agency",
  "roles": [{"id": "role-scout", "code": "R-1", "name": "Scout", "permissions": ["record.RC-1.add.*"]}],
  "workflows": [
    {"id": "wf-keeps", "code": "WF-1", "name": "Keeps tenders"},
    {"id": "wf-pipeline", "code": "WF-2", "name": "Pipeline to submission", "subject_record": "RC-1"}
  ],
  "records": [
    {
      "id": "rec-1", "code": "RC-1", "workflow_id": "wf-keeps", "name": "Tenders",
      "form_name": "Tender", "item_name": "tender",
      "questions": [
        {"prompt": "Tender title", "answer_type": "free_text", "required": true},
        {"prompt": "Stage", "answer_type": "single_choice", "required": true, "options": ["Open", "Accepted"]}
      ]
    }
  ],
  "work_items": [
    {
      "id": "wi-decide", "code": "WI-1", "workflow_id": "wf-pipeline", "title": "Decide the tender", "ordinality": 1,
      "kind": "fill_form", "role_id": "role-scout", "form_name": "Decision",
      "questions": [{"prompt": "Accepted", "answer_type": "yes_no", "required": true}],
      "sets_subject": [{"when": {"question": "Accepted", "operator": "is", "value": "Yes"}, "field": "Stage", "to": "Accepted"}]
    }
  ]
}`

func valuesOf(answers map[string]string) []string {
	out := []string{}
	for _, v := range answers {
		out = append(out, v)
	}
	return out
}

func TestImportKeepsTheSettingsOfAStep(t *testing.T) {
	steps, _ := importedStepsOf(t, settingAgency)
	for _, step := range steps {
		if step.Title != "Decide the tender" {
			continue
		}
		if len(step.SetsSubject) != 1 || step.SetsSubject[0].To != "Accepted" || step.SetsSubject[0].Field != "Stage" {
			t.Errorf("the imported step carries sets_subject %+v", step.SetsSubject)
		}
		return
	}
	t.Fatalf("no imported step Decide the tender in %+v", steps)
}

func TestImportRefusesASettingWhoseOptionTheSubjectRecordDoesNotOffer(t *testing.T) {
	w := newStepRunWalk(t, nil)
	body := strings.Replace(settingAgency, `"to": "Accepted"`, `"to": "Shipped"`, 1)
	rec := w.call(t, "POST", "/instances/import", json.RawMessage(body), w.owner)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "Shipped") {
		t.Fatalf("import answered %d %s, want 400 naming Shipped", rec.Code, rec.Body.String())
	}
}
