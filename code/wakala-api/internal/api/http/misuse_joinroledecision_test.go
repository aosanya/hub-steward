package http

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

func TestJoinRoleDecision_MayorAgentCannotDoApproveJoinRequest(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	perms := map[string][]string{
		"role-mayor": {"report.publish"},
		"role-clerk": {"join_request.decide", "member.invite"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		p, ok := perms[roleID]
		if !ok {
			return nil, errors.New("unknown role")
		}
		return p, nil
	}
	path := "/instances/" + w.instance

	agent := func(subject, roleID string) *http.Cookie {
		c := w.cookieFor(t, subject)
		if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": subject}, w.owner); rec.Code != http.StatusCreated {
			t.Fatalf("owner adds agent %s: %d %s", subject, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "PUT", path+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": roleID}, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("owner links %s to %s: %d %s", subject, roleID, rec.Code, rec.Body.String())
		}
		return c
	}
	mayor := agent("agent-mayor", "role-mayor")
	clerk := agent("agent-clerk", "role-clerk")

	if rec := w.call(t, "PUT", path+"/join-mode", map[string]any{"join_mode": "confirmed"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner sets confirmed join mode: %d %s", rec.Code, rec.Body.String())
	}
	applicant := w.cookieFor(t, "applicant-ben")
	if rec := w.call(t, "POST", path+"/join", map[string]any{"message": "I live on Mill Row"}, applicant); rec.Code != http.StatusAccepted {
		t.Fatalf("applicant asks to join: %d %s, want 202", rec.Code, rec.Body.String())
	}

	approve := path + "/join-requests/applicant-ben/approve"
	if rec := w.call(t, "POST", approve, nil, mayor); rec.Code != http.StatusForbidden {
		t.Fatalf("mayor agent approving a join request: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", approve, nil, clerk); rec.Code != http.StatusNoContent {
		t.Fatalf("clerk agent approving a join request: %d %s, want 204", rec.Code, rec.Body.String())
	}
}
