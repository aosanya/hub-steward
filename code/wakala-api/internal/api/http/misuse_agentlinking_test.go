package http

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

func TestAgentLinking_DraftingAgentCannotDoAddAgentOrLinkItselfToRole(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		if roleID == "role-mayor" {
			return []string{"report.publish"}, nil
		}
		return nil, errors.New("unknown role")
	}
	path := "/instances/" + w.instance

	drafter := w.cookieFor(t, "agent-drafter")
	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": "agent-drafter"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds agent: %d %s", rec.Code, rec.Body.String())
	}
	w.cookieFor(t, "newcomer-eva")

	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": "newcomer-eva"}, drafter); rec.Code != http.StatusForbidden {
		t.Fatalf("agent adding another agent: %d %s, want 403", rec.Code, rec.Body.String())
	}
	link := path + "/members/agent-drafter/agency-role"
	if rec := w.call(t, "PUT", link, map[string]any{"agency_role_id": "role-mayor"}, drafter); rec.Code != http.StatusForbidden {
		t.Fatalf("agent linking itself to a role: %d %s, want 403", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": "newcomer-eva"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adding an agent: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", path+"/members/newcomer-eva/agency-role", map[string]any{"agency_role_id": "role-mayor"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner linking an agent to a role: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
