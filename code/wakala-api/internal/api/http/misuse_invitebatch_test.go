package http

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

func TestInvitationBatch_MayorAgentCannotDoCheckInvitationList(t *testing.T) {
	w := newStepRunWalk(t, referralPlan())
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

	check := path + "/actor/invitations/batch/check"
	rows := map[string]any{"rows": []map[string]any{{"first_name": "Ben", "last_name": "Kiss", "email": "ben@example.test", "group_code": "ward-1"}}}
	if rec := w.call(t, "POST", check, rows, mayor); rec.Code != http.StatusForbidden && rec.Code != http.StatusNotFound {
		t.Fatalf("mayor agent checking an invitation list: %d %s, want 403 or 404", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", check, rows, clerk); rec.Code != http.StatusOK {
		t.Fatalf("clerk agent checking an invitation list: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
