package http

import (
	"net/http"
	"testing"
)

func reviewedReferralPlan() []stepSpec {
	plan := referralPlan()
	plan[1].questions = reviewQuestions()
	plan[1].sendBackDecision = sendBackDecisionPrompt
	plan[1].sendBackReason = sendBackReasonPrompt
	plan[2].questions = reviewQuestions()
	plan[2].sendBackDecision = sendBackDecisionPrompt
	plan[2].sendBackReason = sendBackReasonPrompt
	return plan
}

func (w subjectWalk) sendFromTheTop(t *testing.T, order, row string) int {
	t.Helper()
	body := map[string]any{"answers": referralAnswers(), "order_id": order, "row_id": row}
	return w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps["Report a referral"]+"/answers", body, w.people["Volunteer"]).Code
}

func (w subjectWalk) startedOnATender(t *testing.T) (order, tender string) {
	t.Helper()
	tender = w.seedRow(t, w.tenders, map[string]string{"Tender": "Road survey"})
	sent := w.start(t, map[string]any{"answers": referralAnswers(), "row_id": tender})
	if sent.Code != http.StatusCreated {
		t.Fatalf("start: %d %s", sent.Code, sent.Body.String())
	}
	order, _ = decodeObject(t, sent)["order_id"].(string)
	return order, tender
}

func (w subjectWalk) requireReopenedOnTheTender(t *testing.T, step, order, tender string) string {
	t.Helper()
	reopened := w.waitingFor(t, w.people["Volunteer"], step)
	if reopened == nil {
		t.Fatalf("the volunteer does not find %s open again: %+v", step, w.available(t, w.people["Volunteer"]))
	}
	if reopened["order_id"] != order || reopened["record_code"] != w.tenders.Code || reopened["row_id"] != tender {
		t.Errorf("the reopened step = %v, want run %s with record_code %s and row_id %s", reopened, order, w.tenders.Code, tender)
	}
	rowID, _ := reopened["row_id"].(string)
	return rowID
}

func TestAStepSentBackInASubjectRunKeepsTheSubjectRowAndSendsAgain(t *testing.T) {
	w := newSubjectWalkOn(t, true, reviewedReferralPlan())
	order, tender := w.startedOnATender(t)

	if code, _ := w.sendBack(t, w.people["Liaison"], "Confirm arrival", map[string]any{"order_id": order, "reason": "Wrong clinic"}); code != http.StatusOK {
		t.Fatalf("send back: %d, want 200", code)
	}
	carried := w.requireReopenedOnTheTender(t, "Report a referral", order, tender)

	if code := w.sendFromTheTop(t, order, carried); code != http.StatusCreated {
		t.Fatalf("the volunteer sends the reopened step again: %d, want 201", code)
	}
	if w.waitingFor(t, w.people["Liaison"], "Confirm arrival") == nil {
		t.Errorf("the run does not reach the liaison again: %+v", w.available(t, w.people["Liaison"]))
	}
}

func TestAStepSentBackTwiceInASubjectRunStillKeepsTheSubjectRow(t *testing.T) {
	w := newSubjectWalkOn(t, true, reviewedReferralPlan())
	order, tender := w.startedOnATender(t)
	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{sendBackDecisionPrompt: "yes"}, order); rec.Code != http.StatusCreated {
		t.Fatalf("the liaison confirms: %d %s", rec.Code, rec.Body.String())
	}

	if code, _ := w.sendBack(t, w.people["Coordinator"], "Close the referral", map[string]any{"order_id": order, "reason": "Check again"}); code != http.StatusOK {
		t.Fatalf("the coordinator sends back: %d, want 200", code)
	}
	if code, _ := w.sendBack(t, w.people["Liaison"], "Confirm arrival", map[string]any{"order_id": order, "reason": "Wrong clinic"}); code != http.StatusOK {
		t.Fatalf("the liaison sends back: %d, want 200", code)
	}
	carried := w.requireReopenedOnTheTender(t, "Report a referral", order, tender)

	if code := w.sendFromTheTop(t, order, carried); code != http.StatusCreated {
		t.Fatalf("the volunteer sends the reopened step again: %d, want 201", code)
	}
}

func TestStartingANewSubjectRunOnARetiredRowIsStillRefusedAfterASendBack(t *testing.T) {
	w := newSubjectWalkOn(t, true, reviewedReferralPlan())
	order, tender := w.startedOnATender(t)
	if code, _ := w.sendBack(t, w.people["Liaison"], "Confirm arrival", map[string]any{"order_id": order, "reason": "Wrong clinic"}); code != http.StatusOK {
		t.Fatalf("send back: %d, want 200", code)
	}
	if _, err := w.manager.RetireRecordRow(t.Context(), tender, "someone", "Entered twice"); err != nil {
		t.Fatalf("RetireRecordRow: %v", err)
	}

	rec := w.start(t, map[string]any{"answers": referralAnswers(), "row_id": tender})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("starting a new run on a retired row: %d %s, want 400", rec.Code, rec.Body.String())
	}
}
