package http

import (
	"context"
	"net/http"
	"testing"

	"wakalaserver/internal/agencies"
)

func TestAgencySettings_AgentCannotChangeJoinModeOrName(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	base := "/instances/" + w.instance
	ctx := context.Background()
	if err := w.deps.Registry.AddMember(ctx, w.instance, "agent-linked", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember linked agent: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, "agent-bare", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember bare agent: %v", err)
	}
	if rec := w.call(t, "PUT", base+"/members/agent-linked/agency-role", map[string]any{"agency_role_id": w.roles["Volunteer"]}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner links the agent to a role: %d %s, want 200", rec.Code, rec.Body.String())
	}

	for _, agent := range []string{"agent-linked", "agent-bare"} {
		cookie := w.cookieFor(t, agent)
		if rec := w.call(t, "PUT", base+"/join-mode", map[string]any{"join_mode": "open"}, cookie); rec.Code != http.StatusForbidden {
			t.Fatalf("%s setting the join mode: %d %s, want 403", agent, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "PUT", base+"/name", map[string]any{"name": "Taken over by " + agent}, cookie); rec.Code != http.StatusForbidden {
			t.Fatalf("%s renaming the agency: %d %s, want 403", agent, rec.Code, rec.Body.String())
		}
	}

	if rec := w.call(t, "GET", base, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner reads the agency: %d %s", rec.Code, rec.Body.String())
	} else if mode, _ := decodeObject(t, rec)["join_mode"].(string); mode == "open" {
		t.Fatalf("join mode changed by an agent: %s", rec.Body.String())
	}

	if rec := w.call(t, "PUT", base+"/join-mode", map[string]any{"join_mode": "open"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner setting the join mode: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", base+"/name", map[string]any{"name": "Renamed by the owner"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner renaming the agency: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
