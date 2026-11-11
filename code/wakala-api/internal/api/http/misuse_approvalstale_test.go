package http

import (
	"context"
	"net/http"
	"testing"

	"wakalaserver/internal/agencies"
)

func TestApprovalStale_OwnerCannotDoApproveContentChangedAfterReading(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	path := "/instances/" + w.instance + "/approvals"
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "agent-drafter", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember agent: %v", err)
	}
	agent := w.cookieFor(t, "agent-drafter")
	proposed := w.call(t, "POST", path, map[string]any{"kind": "instance_rename", "summary": "Rename", "payload": map[string]any{"name": "Health program v1"}}, agent)
	if proposed.Code != http.StatusCreated {
		t.Fatalf("agent proposes: %d %s, want 201", proposed.Code, proposed.Body.String())
	}
	id, _ := decodeObject(t, proposed)["id"].(string)
	if rec := w.call(t, "POST", path+"/"+id+"/amendment", map[string]any{"payload_patch": map[string]any{"name": "Swapped"}}, agent); rec.Code != http.StatusOK {
		t.Fatalf("agent amends while pending: %d %s, want 200", rec.Code, rec.Body.String())
	}
	decide := path + "/" + id + "/decision"
	if rec := w.call(t, "POST", decide, map[string]any{"decision": "approved", "reason": "read v1", "seen_amendments": 0}, w.owner); rec.Code != http.StatusConflict {
		t.Fatalf("owner approving content changed after reading: %d %s, want 409", rec.Code, rec.Body.String())
	}
	if got := decodeObject(t, w.call(t, "GET", path+"/"+id, nil, w.owner)); got["status"] != "pending" {
		t.Fatalf("refused decision changed the approval: %v", got["status"])
	}
	if rec := w.call(t, "POST", decide, map[string]any{"decision": "approved", "reason": "read v2", "seen_amendments": 1}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner approving the version read: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
