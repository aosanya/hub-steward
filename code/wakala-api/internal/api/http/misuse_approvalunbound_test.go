package http

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type unboundApprovalWalk struct {
	designAgentWalk
	path string
	id   string
}

func newUnboundApprovalWalk(t *testing.T) unboundApprovalWalk {
	t.Helper()
	w := newDesignAgentWalk(t)
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "agent-drafter", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember agent: %v", err)
	}
	agent := w.cookieFor(t, "agent-drafter")
	path := w.base + "/approvals"
	proposed := w.call(t, "POST", path, map[string]any{"kind": "instance_rename", "summary": "Rename", "payload": map[string]any{"name": "Read version"}}, agent)
	if proposed.Code != http.StatusCreated {
		t.Fatalf("agent proposes: %d %s, want 201", proposed.Code, proposed.Body.String())
	}
	id, _ := decodeObject(t, proposed)["id"].(string)
	return unboundApprovalWalk{designAgentWalk: w, path: path, id: id}
}

func (w unboundApprovalWalk) ownerReads(t *testing.T) {
	t.Helper()
	if rec := w.call(t, "GET", w.path+"/"+w.id, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner reads: %d %s, want 200", rec.Code, rec.Body.String())
	}
}

func (w unboundApprovalWalk) agentAmends(t *testing.T) {
	t.Helper()
	agent := w.cookieFor(t, "agent-drafter")
	if rec := w.call(t, "POST", w.path+"/"+w.id+"/amendment", map[string]any{"summary": "changed", "payload_patch": map[string]any{"name": "Unread version"}}, agent); rec.Code != http.StatusOK {
		t.Fatalf("agent amends: %d %s, want 200", rec.Code, rec.Body.String())
	}
}

func (w unboundApprovalWalk) status(t *testing.T) (string, string) {
	t.Helper()
	got := decodeObject(t, w.call(t, "GET", w.path+"/"+w.id, nil, w.owner))
	status, _ := got["status"].(string)
	payload, _ := got["payload"].(string)
	return status, payload
}

func (w unboundApprovalWalk) agencyName(t *testing.T) string {
	t.Helper()
	name, _ := decodeObject(t, w.call(t, "GET", w.base, nil, w.owner))["name"].(string)
	return name
}

func TestApprovalUnbound_DecisionWithoutSeenAmendmentsIsRefusedOnceTheDraftChanged(t *testing.T) {
	w := newUnboundApprovalWalk(t)
	before := w.agencyName(t)
	w.ownerReads(t)
	w.agentAmends(t)

	rec := w.call(t, "POST", w.path+"/"+w.id+"/decision", map[string]any{"decision": "approved"}, w.owner)
	if rec.Code != http.StatusConflict {
		t.Fatalf("owner approving with no seen_amendments after the agent amended: %d %s, want 409", rec.Code, rec.Body.String())
	}
	if status, _ := w.status(t); status != "pending" {
		t.Fatalf("refused decision left the approval %q, want pending", status)
	}
	if after := w.agencyName(t); after != before {
		t.Fatalf("agency renamed from %q to %q by a decision that named nothing it read", before, after)
	}
}

func TestApprovalUnbound_RefusalWithoutSeenAmendmentsIsRefusedOnceTheDraftChanged(t *testing.T) {
	w := newUnboundApprovalWalk(t)
	w.agentAmends(t)

	rec := w.call(t, "POST", w.path+"/"+w.id+"/decision", map[string]any{"decision": "refused", "reason": "no"}, w.owner)
	if rec.Code != http.StatusConflict {
		t.Fatalf("owner refusing with no seen_amendments after the agent amended: %d %s, want 409", rec.Code, rec.Body.String())
	}
}

func TestApprovalUnbound_DecisionWithoutSeenAmendmentsStillWorksOnAnUnamendedDraft(t *testing.T) {
	w := newUnboundApprovalWalk(t)
	w.ownerReads(t)

	if rec := w.call(t, "POST", w.path+"/"+w.id+"/decision", map[string]any{"decision": "approved"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner approving an unamended draft with no seen_amendments: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if name := w.agencyName(t); name != "Read version" {
		t.Fatalf("agency name %q, want the approved \"Read version\"", name)
	}
}

func TestApprovalUnbound_DecisionOverMCPWithoutSeenAmendmentsIsRefusedOnceTheDraftChanged(t *testing.T) {
	w := newUnboundApprovalWalk(t)
	before := w.agencyName(t)
	w.ownerReads(t)
	w.agentAmends(t)

	out := w.mcpCall(t, "test-owner", "agency_decide_approval", map[string]any{"instance_id": w.instance, "approval_id": w.id, "decision": "approved"})
	if !out.IsError || !strings.Contains(toolErrorText(out), "changed after it was read") {
		t.Fatalf("approving over MCP with no seen_amendments after the agent amended: error=%v %q, want the changed-since-read refusal", out.IsError, toolErrorText(out))
	}
	if status, _ := w.status(t); status != "pending" {
		t.Fatalf("refused decision left the approval %q, want pending", status)
	}
	if after := w.agencyName(t); after != before {
		t.Fatalf("agency renamed from %q to %q over MCP by a decision that named nothing it read", before, after)
	}
}

func TestApprovalUnbound_DecisionOverMCPNamingTheAmendmentsReadIsApproved(t *testing.T) {
	w := newUnboundApprovalWalk(t)
	w.agentAmends(t)

	out := w.mcpCall(t, "test-owner", "agency_decide_approval", map[string]any{"instance_id": w.instance, "approval_id": w.id, "decision": "approved", "seen_amendments": 1})
	if out.IsError {
		t.Fatalf("approving over MCP naming the amendment read: %s", toolErrorText(out))
	}
	if name := w.agencyName(t); name != "Unread version" {
		t.Fatalf("agency name %q, want the approved amended \"Unread version\"", name)
	}
}

func TestApprovalUnbound_ToolTellsACallerToSendSeenAmendments(t *testing.T) {
	w := newUnboundApprovalWalk(t)
	ctx := accounts.WithID(context.Background(), "test-owner")
	serverSide, clientSide := mcp.NewInMemoryTransports()
	session, err := newMCPServer(w.deps).Connect(ctx, serverSide, nil)
	if err != nil {
		t.Fatalf("connect server: %v", err)
	}
	t.Cleanup(func() { session.Close() })
	client, err := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil).Connect(ctx, clientSide, nil)
	if err != nil {
		t.Fatalf("connect client: %v", err)
	}
	t.Cleanup(func() { client.Close() })
	listed, err := client.ListTools(ctx, nil)
	if err != nil {
		t.Fatalf("list tools: %v", err)
	}
	for _, tool := range listed.Tools {
		if tool.Name == "agency_decide_approval" {
			if !strings.Contains(tool.Description, "seen_amendments") {
				t.Fatalf("agency_decide_approval description does not name seen_amendments: %q", tool.Description)
			}
			return
		}
	}
	t.Fatal("agency_decide_approval is not listed")
}
