package http

import (
	"context"
	"net/http"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type designAgentWalk struct {
	stepRunWalk
	base   string
	agent  *http.Cookie
	roleID string
}

func newDesignAgentWalk(t *testing.T) designAgentWalk {
	t.Helper()
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "agent-chat", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember agent: %v", err)
	}
	roleID := w.roles["Volunteer"]
	base := "/instances/" + w.instance
	if rec := w.call(t, "PUT", base+"/members/agent-chat/agency-role", map[string]any{"agency_role_id": roleID}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner links the agent to a role: %d %s, want 200", rec.Code, rec.Body.String())
	}
	return designAgentWalk{stepRunWalk: w, base: base, agent: w.cookieFor(t, "agent-chat"), roleID: roleID}
}

func (w designAgentWalk) mcpCall(t *testing.T, subject, tool string, args map[string]any) *mcp.CallToolResult {
	t.Helper()
	ctx := accounts.WithID(context.Background(), subject)
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
	out, err := client.CallTool(ctx, &mcp.CallToolParams{Name: tool, Arguments: args})
	if err != nil {
		t.Fatalf("call %s: %v", tool, err)
	}
	return out
}

func TestAgentDesign_AgentWithoutPermissionCannotReadTheDesignRoutes(t *testing.T) {
	w := newDesignAgentWalk(t)

	for _, path := range []string{"/goals?draft_id=" + w.draftID, "/roles?draft_id=" + w.draftID, "/workflows?draft_id=" + w.draftID, "/risks?draft_id=" + w.draftID} {
		if rec := w.call(t, "GET", w.base+path, nil, w.agent); rec.Code != http.StatusForbidden {
			t.Errorf("agent reading %s: %d %s, want 403", path, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "GET", w.base+path, nil, w.owner); rec.Code != http.StatusOK {
			t.Errorf("owner reading %s: %d %s, want 200", path, rec.Code, rec.Body.String())
		}
	}
}

func TestAgentDesign_AgentWithRiskReadReadsTheRisksAndNothingElse(t *testing.T) {
	w := newDesignAgentWalk(t)
	if rec := w.call(t, "PATCH", w.base+"/roles/"+w.roleID, map[string]any{"name": "Volunteer", "permissions": []string{"risk.read"}}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner gives the role risk.read: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", w.base+"/risks?draft_id="+w.draftID, nil, w.agent); rec.Code != http.StatusOK {
		t.Errorf("agent holding risk.read listing design risks: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", w.base+"/workflows?draft_id="+w.draftID, nil, w.agent); rec.Code != http.StatusForbidden {
		t.Errorf("agent holding only risk.read listing workflows: %d %s, want 403", rec.Code, rec.Body.String())
	}
}

func TestAgentDesign_AgentWithoutPermissionCannotUseTheAgencyToolsOverMCP(t *testing.T) {
	w := newDesignAgentWalk(t)

	write := map[string]any{"instance_id": w.instance, "draft_id": w.draftID, "name": "Agent made"}
	if out := w.mcpCall(t, "agent-chat", "agency_create_role", write); !out.IsError {
		t.Errorf("agent creating a role over MCP: %+v, want a tool error", out.Content)
	}
	read := map[string]any{"instance_id": w.instance, "draft_id": w.draftID}
	if out := w.mcpCall(t, "agent-chat", "agency_list_goals", read); !out.IsError {
		t.Errorf("agent listing goals over MCP: %+v, want a tool error", out.Content)
	}

	if out := w.mcpCall(t, "test-owner", "agency_create_role", write); out.IsError {
		t.Errorf("owner creating a role over MCP: %+v, want success", out.Content)
	}
	if out := w.mcpCall(t, "test-owner", "agency_list_goals", read); out.IsError {
		t.Errorf("owner listing goals over MCP: %+v, want success", out.Content)
	}
}
