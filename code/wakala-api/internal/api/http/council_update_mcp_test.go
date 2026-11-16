package http

import (
	"strings"
	"testing"
)

func createdMeetingID(t *testing.T, w designAgentWalk) string {
	t.Helper()
	if out := w.mcpCall(t, "test-owner", "council_meeting_create", meetingArgs(w.instance)); out.IsError {
		t.Fatalf("owner creating a meeting: %s", toolErrorText(out))
	}
	listed := councilItemsOf(t, w.mcpCall(t, "test-owner", "council_meeting_list", map[string]any{"instance_id": w.instance}))
	id, _ := listed[0]["id"].(string)
	return id
}

func meetingUpdateArgs(instance, id string) map[string]any {
	return map[string]any{"instance_id": instance, "meetingID": id, "name": "Budget session, moved", "date": "2026-12-10", "place": "Library", "committee": "Finance"}
}

func TestCouncilUpdate_RoleHoldingCouncilManageCorrectsAMeeting(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "council")
	id := createdMeetingID(t, w)
	givesTheRole(t, w, "council.manage")

	if out := w.mcpCall(t, "agent-chat", "council_meeting_update", meetingUpdateArgs(w.instance, id)); out.IsError {
		t.Fatalf("a council.manage holder correcting a meeting: %s", toolErrorText(out))
	}
	read := w.mcpCall(t, "test-owner", "council_meeting_read", map[string]any{"instance_id": w.instance, "meetingID": id})
	if read.IsError {
		t.Fatalf("reading the corrected meeting: %s", toolErrorText(read))
	}
}

func TestCouncilUpdate_RoleHoldingOnlyCouncilViewIsRefusedAndNamesTheManagePermission(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "council")
	id := createdMeetingID(t, w)
	givesTheRole(t, w, "council.view")

	for _, tool := range []string{"council_meeting_update", "council_resolution_update", "council_bylaw_update"} {
		out := w.mcpCall(t, "agent-chat", tool, map[string]any{"instance_id": w.instance, "meetingID": id, "resolutionID": id, "bylawID": id, "name": "x", "title": "x", "date": "2026-12-10"})
		if !out.IsError {
			t.Fatalf("a council.view holder called %s, want a refusal", tool)
		}
		if !strings.Contains(toolErrorText(out), "council.manage") {
			t.Errorf("%s refusal %q does not name council.manage", tool, toolErrorText(out))
		}
	}
}

func TestCouncilUpdate_PersonOutsideTheAgencyCannotCorrectAMeeting(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "council")
	id := createdMeetingID(t, w)

	out := w.mcpCall(t, "stranger", "council_meeting_update", meetingUpdateArgs(w.instance, id))

	if !out.IsError {
		t.Fatalf("a stranger corrected a council meeting, want a refusal")
	}
	if strings.Contains(strings.ToLower(toolErrorText(out)), "permission") {
		t.Errorf("stranger was told %q, which confirms the agency exists", toolErrorText(out))
	}
}
