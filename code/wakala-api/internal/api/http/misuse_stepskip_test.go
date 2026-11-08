package http

import (
	"net/http"
	"testing"
)

func TestStepSkip_LaterStepRoleCannotDoSendBeforeItsTurn(t *testing.T) {
	w := referral(t)

	opened := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Fever", "Minutes to the clinic": "10"}, "")
	if opened.Code != http.StatusCreated {
		t.Fatalf("volunteer opens the run: %d %s, want 201", opened.Code, opened.Body.String())
	}
	order, _ := decodeObject(t, opened)["order_id"].(string)

	if rec := w.submit(t, w.people["Coordinator"], "Close the referral", map[string]string{"Note": "Arrived safely"}, order); rec.Code != http.StatusConflict {
		t.Fatalf("coordinator sends the closing step before the arrival step: %d %s, want 409", rec.Code, rec.Body.String())
	}

	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, order); rec.Code != http.StatusCreated {
		t.Fatalf("liaison sends the step whose turn it is: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
