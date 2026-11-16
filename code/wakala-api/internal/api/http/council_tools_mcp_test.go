package http

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func meetingArgs(instance string) map[string]any {
	return map[string]any{"instance_id": instance, "name": "Budget session", "date": "2026-12-03", "place": "Town hall", "committee": "Finance"}
}

func givesTheRole(t *testing.T, w designAgentWalk, permissions ...string) {
	t.Helper()
	body := map[string]any{"name": "Volunteer", "permissions": permissions}
	if rec := w.call(t, "PATCH", w.base+"/roles/"+w.roleID, body, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner gives the role %v: %d %s, want 200", permissions, rec.Code, rec.Body.String())
	}
}

func councilItemsOf(t *testing.T, out *mcp.CallToolResult) []map[string]any {
	t.Helper()
	if out.IsError {
		t.Fatalf("council tool answered with an error: %s", toolErrorText(out))
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	var body struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatalf("structured content %s does not carry items: %v", encoded, err)
	}
	return body.Items
}

func TestCouncilTools_OwnerCreatesListsAndReadsAMeetingOverTheHubServer(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "council")

	created := w.mcpCall(t, "test-owner", "council_meeting_create", meetingArgs(w.instance))
	if created.IsError {
		t.Fatalf("owner creating a meeting: %s", toolErrorText(created))
	}
	listed := councilItemsOf(t, w.mcpCall(t, "test-owner", "council_meeting_list", map[string]any{"instance_id": w.instance}))
	if len(listed) != 1 || listed[0]["name"] != "Budget session" {
		t.Fatalf("owner lists %+v, want the one Budget session", listed)
	}
	id, _ := listed[0]["id"].(string)
	read := w.mcpCall(t, "test-owner", "council_meeting_read", map[string]any{"instance_id": w.instance, "meetingID": id})
	if read.IsError {
		t.Fatalf("owner reading the meeting: %s", toolErrorText(read))
	}
}

func TestCouncilTools_RoleHoldingCouncilViewListsAndReadsButCannotCreate(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "council")
	if out := w.mcpCall(t, "test-owner", "council_meeting_create", meetingArgs(w.instance)); out.IsError {
		t.Fatalf("owner creating a meeting: %s", toolErrorText(out))
	}
	givesTheRole(t, w, "council.view")

	listed := councilItemsOf(t, w.mcpCall(t, "agent-chat", "council_meeting_list", map[string]any{"instance_id": w.instance}))
	if len(listed) != 1 {
		t.Fatalf("a council.view holder lists %d meetings, want 1", len(listed))
	}
	id, _ := listed[0]["id"].(string)
	if out := w.mcpCall(t, "agent-chat", "council_meeting_read", map[string]any{"instance_id": w.instance, "meetingID": id}); out.IsError {
		t.Errorf("a council.view holder reading a meeting: %s", toolErrorText(out))
	}
	if out := w.mcpCall(t, "agent-chat", "council_meeting_create", meetingArgs(w.instance)); !out.IsError {
		t.Errorf("a council.view holder created a meeting, want a refusal")
	}
}

func TestCouncilTools_RoleHoldingCouncilManageCreatesAMeeting(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "council")
	givesTheRole(t, w, "council.manage")

	if out := w.mcpCall(t, "agent-chat", "council_meeting_create", meetingArgs(w.instance)); out.IsError {
		t.Fatalf("a council.manage holder creating a meeting: %s", toolErrorText(out))
	}
}

func TestCouncilTools_RoleWithoutACouncilPermissionIsRefusedAndNamesThePermission(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "council")

	out := w.mcpCall(t, "agent-chat", "council_meeting_list", map[string]any{"instance_id": w.instance})

	if !out.IsError {
		t.Fatalf("an agent holding no council permission listed meetings, want a refusal")
	}
	if !strings.Contains(toolErrorText(out), "council.view") {
		t.Errorf("refusal %q does not name council.view", toolErrorText(out))
	}
}

func TestCouncilTools_PersonOutsideTheAgencyIsRefusedLikeAnUnknownAgency(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "council")

	out := w.mcpCall(t, "stranger", "council_meeting_list", map[string]any{"instance_id": w.instance})

	if !out.IsError {
		t.Fatalf("a stranger listing council meetings succeeded, want a refusal")
	}
	if strings.Contains(strings.ToLower(toolErrorText(out)), "permission") {
		t.Errorf("stranger was told %q, which confirms the agency exists", toolErrorText(out))
	}
}

func TestCouncilTools_AgencyWithoutTheCouncilModuleRefusesEvenItsOwner(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "forms")

	if out := w.mcpCall(t, "test-owner", "council_meeting_list", map[string]any{"instance_id": w.instance}); !out.IsError {
		t.Fatalf("owner of an agency without council listed meetings, want a refusal")
	}
}

func TestCouncilTools_ListNeedsTheAgencyNamed(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "council")

	if out := w.mcpCall(t, "test-owner", "council_meeting_list", map[string]any{}); !out.IsError {
		t.Fatalf("listing without instance_id succeeded, want a refusal")
	}
}

func TestToolList_TheOwnerOfAnAgencyRunningCouncilSeesTheCouncilToolsAndOthersDoNot(t *testing.T) {
	w := newToolListWalk(t)
	runsModules(t, w.instance, "council")
	want := []string{"council_meeting_create", "council_meeting_list", "council_meeting_read", "council_agenda_set", "council_minutes_read", "council_resolution_create", "council_bylaw_list"}

	seen := w.toolsSeenBy(t, w.owner)
	for _, name := range want {
		if !contains(seen, name) {
			t.Errorf("owner of an agency running council cannot see %s", name)
		}
	}
	if got := modulesOf(seen)["council"]; got != 16 {
		t.Errorf("owner sees %d council tools, want 16", got)
	}

	runsModules(t, w.instance, "forms")
	if got := modulesOf(w.toolsSeenBy(t, w.owner))["council"]; got != 0 {
		t.Errorf("owner of an agency without council sees %d council tools", got)
	}
}

func TestCouncilTools_ServerWithoutACouncilManagerRefusesTheCall(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "council")
	w.deps.Council = nil

	if out := w.mcpCall(t, "test-owner", "council_meeting_list", map[string]any{"instance_id": w.instance}); !out.IsError {
		t.Fatalf("listing with no council manager succeeded, want a refusal")
	}
}
