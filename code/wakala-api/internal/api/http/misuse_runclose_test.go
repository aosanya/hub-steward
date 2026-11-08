package http

import (
	"net/http"
	"testing"
)

func TestRunClose_StepRoleCannotDoSendAStepAfterTheRunIsClosed(t *testing.T) {
	w := referral(t)

	sent := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Fever", "Minutes to the clinic": "10"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("volunteer opens the run: %d %s, want 201", sent.Code, sent.Body.String())
	}
	order, _ := decodeObject(t, sent)["order_id"].(string)
	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, order); rec.Code != http.StatusCreated {
		t.Fatalf("liaison sends her step before close: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if rec := w.submit(t, w.people["Coordinator"], "Close the referral", map[string]string{"Note": "Arrived safely"}, order); rec.Code != http.StatusCreated {
		t.Fatalf("coordinator closes the run: %d %s, want 201", rec.Code, rec.Body.String())
	}

	if rec := w.submit(t, w.people["Coordinator"], "Close the referral", map[string]string{"Note": "Changed my mind"}, order); rec.Code != http.StatusConflict {
		t.Fatalf("coordinator sending the closing step again after close: %d %s, want 409", rec.Code, rec.Body.String())
	}
	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "no"}, order); rec.Code != http.StatusConflict {
		t.Fatalf("liaison sending her step after close: %d %s, want 409", rec.Code, rec.Body.String())
	}
	if got := titles(w.available(t, w.people["Liaison"])); len(got) != 0 {
		t.Fatalf("liaison still sees %v after close", got)
	}

	next := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Injury", "Minutes to the clinic": "20"}, "")
	if next.Code != http.StatusCreated {
		t.Fatalf("volunteer opens a fresh run: %d %s, want 201", next.Code, next.Body.String())
	}
	fresh, _ := decodeObject(t, next)["order_id"].(string)
	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, fresh); rec.Code != http.StatusCreated {
		t.Fatalf("liaison sends her step on the open run: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
