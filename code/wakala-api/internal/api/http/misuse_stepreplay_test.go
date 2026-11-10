package http

import (
	"net/http"
	"testing"
)

func TestStepRun_StepRoleCannotDoSendTheSameStepTwice(t *testing.T) {
	w := referral(t)

	opened := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Fever", "Minutes to the clinic": "10"}, "")
	if opened.Code != http.StatusCreated {
		t.Fatalf("volunteer opens the run: %d %s, want 201", opened.Code, opened.Body.String())
	}
	order, _ := decodeObject(t, opened)["order_id"].(string)

	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, order); rec.Code != http.StatusCreated {
		t.Fatalf("liaison sends the step whose turn it is: %d %s, want 201", rec.Code, rec.Body.String())
	}

	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "no"}, order); rec.Code != http.StatusConflict {
		t.Fatalf("liaison sends the same step a second time: %d %s, want 409", rec.Code, rec.Body.String())
	}
}

func TestStepRun_OpeningRoleCannotDoNameARunOnTheFirstStep(t *testing.T) {
	w := referral(t)

	first := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Fever", "Minutes to the clinic": "10"}, "")
	if first.Code != http.StatusCreated {
		t.Fatalf("volunteer opens a run with no order: %d %s, want 201", first.Code, first.Body.String())
	}
	order, _ := decodeObject(t, first)["order_id"].(string)

	if rec := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Cough", "Minutes to the clinic": "5"}, order); rec.Code != http.StatusBadRequest {
		t.Fatalf("volunteer names a run on the first step: %d %s, want 400", rec.Code, rec.Body.String())
	}
}
