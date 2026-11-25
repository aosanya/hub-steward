package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type subjectWalk struct {
	stepRunWalk
	manager mwanachamaagency.AgencyManager
	liveID  string
	tenders agencymodels.Record
	clients agencymodels.Record
}

func newSubjectWalk(t *testing.T, subject bool) subjectWalk {
	t.Helper()
	return newSubjectWalkOn(t, subject, referralPlan())
}

func newSubjectWalkOn(t *testing.T, subject bool, plan []stepSpec) subjectWalk {
	t.Helper()
	w := newStepRunWalk(t, plan, "Volunteer", "Liaison", "Coordinator")
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	tenders, err := mgr.CreateRecord(ctx, agencymodels.Record{
		DraftID: w.draftID, WorkflowID: w.workflow, Name: "Tenders", ItemName: "Tender",
		FormName: "Tender", Questions: tenderQuestions(),
	})
	if err != nil {
		t.Fatalf("CreateRecord Tenders: %v", err)
	}
	letRoleAdd(t, mgr, w.roles["Coordinator"], tenders)
	clients, err := mgr.CreateRecord(ctx, agencymodels.Record{
		DraftID: w.draftID, WorkflowID: w.workflow, Name: "Clients", ItemName: "Client",
		FormName: "Client", Questions: []agencymodels.StepQuestion{{Prompt: "Client", AnswerType: agencymodels.AnswerFreeText, Required: true}},
	})
	if err != nil {
		t.Fatalf("CreateRecord Clients: %v", err)
	}
	letRoleAdd(t, mgr, w.roles["Coordinator"], clients)
	if subject {
		workflow, err := mgr.GetWorkflow(ctx, w.workflow)
		if err != nil {
			t.Fatalf("GetWorkflow: %v", err)
		}
		workflow.SubjectRecord = tenders.Key
		if _, err := mgr.UpdateWorkflow(ctx, workflow); err != nil {
			t.Fatalf("UpdateWorkflow: %v", err)
		}
	}
	w.publish(t)
	live, err := liveDraftOf(ctx, mgr)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	return subjectWalk{stepRunWalk: w, manager: mgr, liveID: live, tenders: tenders, clients: clients}
}

func (w subjectWalk) seedRow(t *testing.T, record agencymodels.Record, answers map[string]string) string {
	t.Helper()
	row, err := w.manager.CreateRecordRow(context.Background(), agencymodels.RecordRow{
		DraftID: w.liveID, RecordID: record.ID, RoleID: addingRoleOf(t, w.manager, w.liveID, record), AddedBy: "seed", Answers: answers,
	})
	if err != nil {
		t.Fatalf("seed row of %s: %v", record.Name, err)
	}
	return row.ID
}

func (w subjectWalk) start(t *testing.T, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	return w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps["Report a referral"]+"/answers", body, w.people["Volunteer"])
}

func referralAnswers() map[string]string {
	return map[string]string{"Reason": "Fever", "Minutes to the clinic": "20"}
}

func TestStartingASubjectWorkflowWithoutARowIsRefused(t *testing.T) {
	w := newSubjectWalk(t, true)
	w.seedRow(t, w.tenders, map[string]string{"Tender": "Road survey"})

	rec := w.start(t, map[string]any{"answers": referralAnswers()})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("starting without row_id: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestStartingASubjectWorkflowOnARowOfAnotherRecordIsRefused(t *testing.T) {
	w := newSubjectWalk(t, true)
	w.seedRow(t, w.tenders, map[string]string{"Tender": "Road survey"})
	client := w.seedRow(t, w.clients, map[string]string{"Client": "Ministry"})

	rec := w.start(t, map[string]any{"answers": referralAnswers(), "row_id": client})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("starting on a row of Clients: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestStartingASubjectWorkflowOnARowThatDoesNotExistIsRefused(t *testing.T) {
	w := newSubjectWalk(t, true)

	rec := w.start(t, map[string]any{"answers": referralAnswers(), "row_id": "no-such-row"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("starting on a missing row: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestASubjectRunKeepsItsRecordAndRowAtEveryStep(t *testing.T) {
	w := newSubjectWalk(t, true)
	tender := w.seedRow(t, w.tenders, map[string]string{"Tender": "Road survey"})

	sent := w.start(t, map[string]any{"answers": referralAnswers(), "row_id": tender})
	if sent.Code != http.StatusCreated {
		t.Fatalf("starting on the right row: %d %s, want 201", sent.Code, sent.Body.String())
	}
	started := decodeObject(t, sent)
	order, _ := started["order_id"].(string)
	next, _ := started["next_step"].(map[string]any)
	if next["record_code"] != w.tenders.Key || next["row_id"] != tender {
		t.Errorf("the next step of the start reply = %v, want record_code %s and row_id %s", next, w.tenders.Key, tender)
	}

	liaison := w.available(t, w.people["Liaison"])
	if len(liaison) != 1 || liaison[0]["order_id"] != order || liaison[0]["record_code"] != w.tenders.Key || liaison[0]["row_id"] != tender {
		t.Fatalf("the liaison's open steps = %v, want one waiting step of run %s with record_code %s and row_id %s", liaison, order, w.tenders.Key, tender)
	}
	arrived := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, order)
	if arrived.Code != http.StatusCreated {
		t.Fatalf("the liaison confirms: %d %s", arrived.Code, arrived.Body.String())
	}
	following, _ := decodeObject(t, arrived)["next_step"].(map[string]any)
	if following["record_code"] != w.tenders.Key || following["row_id"] != tender {
		t.Errorf("the next step after the liaison = %v, want record_code %s and row_id %s", following, w.tenders.Key, tender)
	}
	coordinator := w.available(t, w.people["Coordinator"])
	if len(coordinator) != 1 || coordinator[0]["order_id"] != order || coordinator[0]["record_code"] != w.tenders.Key || coordinator[0]["row_id"] != tender {
		t.Fatalf("the coordinator's open steps = %v, want one waiting step of run %s with record_code %s and row_id %s", coordinator, order, w.tenders.Key, tender)
	}
}

func TestTheStartStepOfASubjectWorkflowNamesItsSubjectRecord(t *testing.T) {
	w := newSubjectWalk(t, true)

	volunteer := w.available(t, w.people["Volunteer"])
	if len(volunteer) != 1 || volunteer[0]["state"] != "start" || volunteer[0]["subject_record"] != w.tenders.Key {
		t.Fatalf("the volunteer's open steps = %v, want one start step with subject_record %s", volunteer, w.tenders.Key)
	}
}

func TestEveryWaitingStepOfASubjectRunNamesTheSubjectRecord(t *testing.T) {
	w := newSubjectWalk(t, true)
	tender := w.seedRow(t, w.tenders, map[string]string{"Tender": "Road survey"})
	if sent := w.start(t, map[string]any{"answers": referralAnswers(), "row_id": tender}); sent.Code != http.StatusCreated {
		t.Fatalf("start: %d %s", sent.Code, sent.Body.String())
	}

	liaison := w.available(t, w.people["Liaison"])
	if len(liaison) != 1 || liaison[0]["subject_record"] != w.tenders.Key {
		t.Fatalf("the liaison's open steps = %v, want subject_record %s", liaison, w.tenders.Key)
	}
}

func TestTheWorkflowListCarriesTheSubjectRecord(t *testing.T) {
	w := newSubjectWalk(t, true)

	rec := w.call(t, "GET", "/instances/"+w.instance+"/workflows?draft_id="+w.liveID, nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("list workflows: %d %s", rec.Code, rec.Body.String())
	}
	var found map[string]any
	for _, item := range decodeObjects(t, rec) {
		if item["id"] == w.workflow {
			found = item
		}
	}
	if found["subject_record"] != w.tenders.Key {
		t.Errorf("the listed workflow = %v, want subject_record %s", found, w.tenders.Key)
	}
}

func TestAWorkflowWithoutASubjectNamesNoSubjectRecord(t *testing.T) {
	w := newSubjectWalk(t, false)

	volunteer := w.available(t, w.people["Volunteer"])
	if len(volunteer) != 1 || volunteer[0]["subject_record"] != nil {
		t.Fatalf("the volunteer's open steps = %v, want no subject_record", volunteer)
	}
	rec := w.start(t, map[string]any{"answers": referralAnswers()})
	if rec.Code != http.StatusCreated {
		t.Fatalf("starting without a subject: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if next, _ := decodeObject(t, rec)["next_step"].(map[string]any); next["row_id"] != nil || next["subject_record"] != nil {
		t.Errorf("the next step = %v, want no row_id and no subject_record", next)
	}
}
