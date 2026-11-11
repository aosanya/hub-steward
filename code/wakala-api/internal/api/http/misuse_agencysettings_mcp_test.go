package http

import (
	"context"
	nethttp "net/http"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/agencies"
)

func toolErrorText(out *mcp.CallToolResult) string {
	var text strings.Builder
	for _, c := range out.Content {
		if t, ok := c.(*mcp.TextContent); ok {
			text.WriteString(t.Text)
		}
	}
	return text.String()
}

func TestAgencySettingsMCP_AgentCannotChangeJoinModeNameOrLanguages(t *testing.T) {
	w := newDesignAgentWalk(t)
	ctx := context.Background()
	if err := w.deps.Registry.AddMember(ctx, w.instance, "agent-bare", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember bare agent: %v", err)
	}
	if w.deps.Permissions != nil {
		t.Fatalf("the walk mounts a permissions module; the gap is the unmounted case")
	}

	calls := map[string]map[string]any{
		"instance_set_join_mode": {"instance_id": w.instance, "join_mode": "open"},
		"instance_rename":        {"instance_id": w.instance, "name": "Taken over"},
		"instance_set_languages": {"instance_id": w.instance, "studio_default": "en", "content": []string{"en"}, "content_default": "en"},
	}
	for _, agent := range []string{"agent-chat", "agent-bare"} {
		for tool, args := range calls {
			if out := w.mcpCall(t, agent, tool, args); !out.IsError {
				t.Errorf("%s calling %s: succeeded, want a tool error", agent, tool)
			}
		}
	}

	if rec := w.call(t, "GET", w.base, nil, w.owner); rec.Code != nethttp.StatusOK {
		t.Fatalf("owner reads the agency: %d %s", rec.Code, rec.Body.String())
	} else {
		object := decodeObject(t, rec)
		if mode, _ := object["join_mode"].(string); mode == "open" {
			t.Fatalf("join mode changed by an agent: %s", rec.Body.String())
		}
		if name, _ := object["name"].(string); name == "Taken over" {
			t.Fatalf("agency renamed by an agent: %s", rec.Body.String())
		}
	}
}

func TestAgencySettingsMCP_OwnerChangesJoinModeAndName(t *testing.T) {
	w := newDesignAgentWalk(t)

	if out := w.mcpCall(t, "test-owner", "instance_set_join_mode", map[string]any{"instance_id": w.instance, "join_mode": "open"}); out.IsError {
		t.Errorf("owner setting the join mode: %s", toolErrorText(out))
	}
	if out := w.mcpCall(t, "test-owner", "instance_rename", map[string]any{"instance_id": w.instance, "name": "Renamed by the owner"}); out.IsError {
		t.Errorf("owner renaming the agency: %s", toolErrorText(out))
	}
}

func TestAgencySettingsMCP_ResidentAndStrangerAreToldInstanceNotFound(t *testing.T) {
	w := newDesignAgentWalk(t)
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "resident-x", agencies.RoleResident); err != nil {
		t.Fatalf("AddMember resident: %v", err)
	}

	for _, who := range []string{"resident-x", "stranger-x"} {
		out := w.mcpCall(t, who, "instance_set_join_mode", map[string]any{"instance_id": w.instance, "join_mode": "open"})
		if !out.IsError || !strings.Contains(toolErrorText(out), "instance not found") {
			t.Errorf("%s setting the join mode: error=%v %q, want \"instance not found\"", who, out.IsError, toolErrorText(out))
		}
	}
}

func TestAgencySettingsMCP_AgentCanStillReadJoinModeAndLanguages(t *testing.T) {
	w := newDesignAgentWalk(t)

	if out := w.mcpCall(t, "agent-chat", "instance_get_join_mode", map[string]any{"instance_id": w.instance}); out.IsError {
		t.Errorf("agent reading the join mode: %s", toolErrorText(out))
	}
}
