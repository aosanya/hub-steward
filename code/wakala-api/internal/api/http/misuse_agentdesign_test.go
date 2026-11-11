package http

import (
	"context"
	"net/http"
	"testing"

	"wakalaserver/internal/agencies"
)

func TestAgentDesign_AgentCannotDoRewriteRolesOrWorkflows(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	base := "/instances/" + w.instance
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "agent-chat", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember agent: %v", err)
	}
	agent := w.cookieFor(t, "agent-chat")
	roleID := w.roles["Volunteer"]
	if rec := w.call(t, "PUT", base+"/members/agent-chat/agency-role", map[string]any{"agency_role_id": roleID}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner links the agent to a role: %d %s, want 200", rec.Code, rec.Body.String())
	}

	widen := map[string]any{"name": "Volunteer", "permissions": []string{"join_request.decide"}}
	if rec := w.call(t, "PATCH", base+"/roles/"+roleID, widen, agent); rec.Code < 400 {
		t.Fatalf("agent rewriting its own role's permissions: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", base+"/roles", map[string]any{"draft_id": w.draftID, "name": "Agent made", "permissions": []string{"join_request.decide"}}, agent); rec.Code < 400 {
		t.Fatalf("agent creating a role: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PATCH", base+"/workflows/"+w.workflow, map[string]any{"draft_id": w.draftID, "name": "Agent renamed"}, agent); rec.Code < 400 {
		t.Fatalf("agent patching a workflow: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "POST", base+"/roles", map[string]any{"draft_id": w.draftID, "name": "Owner made"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner creating a role: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
