package http

import (
	"context"
	"net/http"
	"testing"

	"wakalaserver/internal/agencies"
)

func TestApprovalReplay_AgentAndOwnerCannotDoReplayOrAmendDecidedApproval(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	path := "/instances/" + w.instance + "/approvals"
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "agent-drafter", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember agent: %v", err)
	}
	agent := w.cookieFor(t, "agent-drafter")

	proposed := w.call(t, "POST", path, map[string]any{"kind": "instance_rename", "summary": "Rename the program", "payload": map[string]any{"name": "Health and care program"}}, agent)
	if proposed.Code != http.StatusCreated {
		t.Fatalf("agent proposes: %d %s, want 201", proposed.Code, proposed.Body.String())
	}
	id, _ := decodeObject(t, proposed)["id"].(string)
	if id == "" {
		t.Fatalf("no approval id in %s", proposed.Body.String())
	}
	decide := path + "/" + id + "/decision"

	if rec := w.call(t, "POST", decide, map[string]any{"decision": "approved", "reason": "agreed"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner deciding the agent's proposal: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", decide, map[string]any{"decision": "refused", "reason": "flip"}, w.owner); rec.Code != http.StatusConflict {
		t.Fatalf("owner replaying a decided approval: %d %s, want 409", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", path+"/"+id+"/amendment", map[string]any{"summary": "Rename to something else", "payload_patch": map[string]any{"name": "Other"}}, agent); rec.Code != http.StatusConflict {
		t.Fatalf("agent amending a decided approval: %d %s, want 409", rec.Code, rec.Body.String())
	}
	got := w.call(t, "GET", path+"/"+id, nil, w.owner)
	if got.Code != http.StatusOK || decodeObject(t, got)["status"] != "approved" {
		t.Fatalf("approval after refused acts: %d %s, want approved", got.Code, got.Body.String())
	}
}
