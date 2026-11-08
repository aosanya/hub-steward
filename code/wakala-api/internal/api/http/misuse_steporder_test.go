package http

import (
	"net/http"
	"testing"
)

func TestStepRun_StepRoleCannotDoSendWithAForeignOrderID(t *testing.T) {
	w := referral(t)

	opened := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Fever", "Minutes to the clinic": "10"}, "")
	if opened.Code != http.StatusCreated {
		t.Fatalf("volunteer opens the run: %d %s, want 201", opened.Code, opened.Body.String())
	}
	order, _ := decodeObject(t, opened)["order_id"].(string)

	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, "11111111-2222-3333-4444-555555555555"); rec.Code != http.StatusConflict {
		t.Fatalf("liaison sends her step with a made-up order id: %d %s, want 409", rec.Code, rec.Body.String())
	}

	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, order); rec.Code != http.StatusCreated {
		t.Fatalf("liaison sends her step with the run's real order id: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
