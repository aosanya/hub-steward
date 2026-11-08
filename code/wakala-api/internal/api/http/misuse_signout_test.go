package http

import (
	"net/http"
	"testing"
)

func TestSignOut_SignedOutCookieCannotDoReachTheAgency(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	path := "/instances/" + w.instance
	resident := w.people["Volunteer"]

	if rec := w.call(t, "GET", "/auth/session", nil, resident); rec.Code != http.StatusOK {
		t.Fatalf("resident session before sign-out: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", path+"/my-open-steps", nil, resident); rec.Code != http.StatusOK {
		t.Fatalf("resident reading open steps before sign-out: %d %s, want 200", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "POST", "/auth/signout", nil, resident); rec.Code != http.StatusNoContent {
		t.Fatalf("resident signs out: %d %s, want 204", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "GET", "/auth/session", nil, resident); rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed-out cookie asking for its session: %d %s, want 401", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", path+"/my-open-steps", nil, resident); rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed-out cookie reading open steps: %d %s, want 401", rec.Code, rec.Body.String())
	}
	answers := map[string]string{"Reason": "Sprained ankle", "Minutes to the clinic": "15"}
	if rec := w.submit(t, resident, "Report a referral", answers, ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed-out cookie sending a step: %d %s, want 401", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "GET", path, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner still signed in reading the agency: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
