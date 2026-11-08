package http

import (
	"net/http"
	"testing"
)

func TestStepAnswer_UnnamedRoleCannotDoSendAnotherRolesStep(t *testing.T) {
	w := referral(t)
	answers := map[string]string{"Reason": "Sprained ankle", "Minutes to the clinic": "15"}

	if rec := w.submit(t, w.people["Liaison"], "Report a referral", answers, ""); rec.Code != http.StatusForbidden {
		t.Fatalf("liaison sending the volunteer's step: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.submit(t, w.people["Coordinator"], "Report a referral", answers, ""); rec.Code != http.StatusForbidden {
		t.Fatalf("coordinator sending the volunteer's step: %d %s, want 403", rec.Code, rec.Body.String())
	}

	if rec := w.submit(t, w.people["Volunteer"], "Report a referral", answers, ""); rec.Code != http.StatusCreated {
		t.Fatalf("volunteer sending the volunteer's step: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
