package http

import (
	"context"
	"net/http"
	"testing"

	"wakalaserver/internal/agencies"
)

func TestApprovalDecision_AgentCannotDoDecideOrAmendOwnersProposal(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	path := "/instances/" + w.instance + "/approvals"
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "agent-intake", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember agent: %v", err)
	}
	agent := w.cookieFor(t, "agent-intake")

	proposed := w.call(t, "POST", path, map[string]any{"kind": "instance_rename", "summary": "Rename the program", "payload": map[string]any{"name": "Health and care program"}}, w.owner)
	if proposed.Code != http.StatusCreated {
		t.Fatalf("owner proposes: %d %s, want 201", proposed.Code, proposed.Body.String())
	}
	id, _ := decodeObject(t, proposed)["id"].(string)
	if id == "" {
		t.Fatalf("no approval id in %s", proposed.Body.String())
	}

	decide := path + "/" + id + "/decision"
	if rec := w.call(t, "POST", decide, map[string]any{"decision": "approved", "reason": "looks fine"}, agent); rec.Code < 400 {
		t.Fatalf("agent deciding the owner's proposal: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", decide, map[string]any{"decision": "approved", "reason": "looks fine"}, w.people["Volunteer"]); rec.Code < 400 {
		t.Fatalf("seated resident deciding the owner's proposal: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", path+"/"+id+"/amendment", map[string]any{"summary": "Rename to something else"}, agent); rec.Code < 400 {
		t.Fatalf("agent amending the owner's proposal: %d %s, want refused", rec.Code, rec.Body.String())
	}

	got := w.call(t, "GET", path+"/"+id, nil, w.owner)
	if got.Code != http.StatusOK || decodeObject(t, got)["status"] != "pending" {
		t.Fatalf("proposal after refused acts: %d %s, want pending", got.Code, got.Body.String())
	}
	if rec := w.call(t, "POST", decide, map[string]any{"decision": "approved", "reason": "agreed"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner deciding the proposal: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
