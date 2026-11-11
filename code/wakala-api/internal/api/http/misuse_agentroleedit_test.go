package http

import (
	"net/http"
	"testing"
)

func TestAgencyRole_AgentCannotDoEditItsOwnRolePermissions(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	path := "/instances/" + w.instance
	roleID := w.roles["Volunteer"]

	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": "agent-bea"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds an agent: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", path+"/members/agent-bea/agency-role", map[string]any{"agency_role_id": roleID}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner links the agent to a role: %d %s", rec.Code, rec.Body.String())
	}
	agent := w.cookieFor(t, "agent-bea")

	if rec := w.call(t, "PUT", path+"/join-mode", map[string]any{"join_mode": "confirmed"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner sets confirmed join mode: %d %s", rec.Code, rec.Body.String())
	}
	applicant := w.cookieFor(t, "applicant-cyd")
	if rec := w.call(t, "POST", path+"/join", map[string]any{"message": "I live on Oak Lane"}, applicant); rec.Code != http.StatusAccepted {
		t.Fatalf("applicant asks to join: %d %s", rec.Code, rec.Body.String())
	}
	approve := path + "/join-requests/applicant-cyd/approve"
	if rec := w.call(t, "POST", approve, nil, agent); rec.Code != http.StatusForbidden {
		t.Fatalf("agent without join_request.decide approving: %d %s, want 403", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "GET", path+"/roles/"+roleID, nil, agent); rec.Code != http.StatusForbidden {
		t.Fatalf("agent without a design read permission reads its own role: %d %s, want 403", rec.Code, rec.Body.String())
	}
	read := w.call(t, "GET", path+"/roles/"+roleID, nil, w.owner)
	if read.Code != http.StatusOK {
		t.Fatalf("owner reads the role: %d %s", read.Code, read.Body.String())
	}
	role := decodeObject(t, read)
	perms, _ := role["permissions"].([]any)
	widened := map[string]any{}
	for k, v := range role {
		widened[k] = v
	}
	widened["permissions"] = append(append([]any{}, perms...), "join_request.decide")

	if rec := w.call(t, "PATCH", path+"/roles/"+roleID, widened, agent); rec.Code != http.StatusForbidden {
		t.Errorf("agent adding join_request.decide to its own role: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", approve, nil, agent); rec.Code < 400 {
		t.Errorf("agent approving after editing its own role: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "PATCH", path+"/roles/"+roleID, role, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner edits the role: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
