package http

import (
	"net/http"
	"testing"
)

func TestJoinDecision_ApplicantCannotDoApproveOwnJoinRequest(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	path := "/instances/" + w.instance

	if rec := w.call(t, "PUT", path+"/join-mode", map[string]any{"join_mode": "confirmed"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner sets confirmed join mode: %d %s", rec.Code, rec.Body.String())
	}
	applicant := w.cookieFor(t, "applicant-ada")
	if rec := w.call(t, "POST", path+"/join", map[string]any{"message": "I live on Elm Street"}, applicant); rec.Code != http.StatusAccepted {
		t.Fatalf("applicant asks to join: %d %s, want 202", rec.Code, rec.Body.String())
	}

	approve := path + "/join-requests/applicant-ada/approve"
	if rec := w.call(t, "POST", approve, nil, applicant); rec.Code < 400 {
		t.Fatalf("applicant approving own join request: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", approve, nil, w.people["Volunteer"]); rec.Code < 400 {
		t.Fatalf("resident approving someone's join request: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", path+"/join-requests", nil, applicant); rec.Code < 400 {
		t.Fatalf("applicant listing join requests: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "POST", approve, nil, w.owner); rec.Code != http.StatusNoContent {
		t.Fatalf("owner approving the join request: %d %s, want 204", rec.Code, rec.Body.String())
	}
}
