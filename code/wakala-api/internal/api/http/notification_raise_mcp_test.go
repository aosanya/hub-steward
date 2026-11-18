package http

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func reportHandedOverArgs(instance, recipient string) map[string]any {
	return map[string]any{
		"instance_id":  instance,
		"recipient_id": recipient,
		"category":     "report",
		"event":        "report_handed_over",
		"subject_kind": "report",
		"subject_id":   "2026-01-01~2026-12-31",
		"names":        map[string]string{"report": "Annual report", "period": "2026"},
	}
}

func notificationEventsOf(t *testing.T, out *mcp.CallToolResult) []string {
	t.Helper()
	if out.IsError {
		t.Fatalf("notification list answered with an error: %s", toolErrorText(out))
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	var body struct {
		Items []struct {
			Event string `json:"event"`
		} `json:"items"`
	}
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatalf("structured content %s does not carry items: %v", encoded, err)
	}
	events := []string{}
	for _, item := range body.Items {
		events = append(events, item.Event)
	}
	return events
}

func TestNotificationRaise_TheOwnerTellsOnePersonAboutAReportAndOnlyThatPersonReadsIt(t *testing.T) {
	w := newDesignAgentWalk(t)

	raised := w.mcpCall(t, "test-owner", "comm_notification_raise", reportHandedOverArgs(w.instance, "agent-chat"))
	if raised.IsError {
		t.Fatalf("owner raising a report_handed_over: %s", toolErrorText(raised))
	}
	list := map[string]any{"instance_id": w.instance}
	got := notificationEventsOf(t, w.mcpCall(t, "agent-chat", "comm_notification_list", list))
	if len(got) != 1 || got[0] != "report_handed_over" {
		t.Fatalf("the recipient lists %v, want one report_handed_over", got)
	}
	for _, event := range notificationEventsOf(t, w.mcpCall(t, "test-owner", "comm_notification_list", list)) {
		if event == "report_handed_over" {
			t.Fatalf("the sender's own list holds the notification it raised for someone else")
		}
	}
}

func TestNotificationRaise_AnyEventButTheReportOneIsRefused(t *testing.T) {
	w := newDesignAgentWalk(t)
	args := reportHandedOverArgs(w.instance, "agent-chat")
	args["event"] = "counter_sent"
	args["category"] = "market"
	args["subject_kind"] = "quote"

	out := w.mcpCall(t, "test-owner", "comm_notification_raise", args)
	if !out.IsError {
		t.Fatalf("a counter_sent raised by a caller was accepted, want a refusal")
	}
	if !strings.Contains(strings.ToLower(toolErrorText(out)), "raise") {
		t.Fatalf("the refusal reads %q, want it to say the event may not be raised", toolErrorText(out))
	}
}

func TestNotificationRaise_ARoleWithoutThePermissionCannotRaise(t *testing.T) {
	w := newDesignAgentWalk(t)

	if out := w.mcpCall(t, "agent-chat", "comm_notification_raise", reportHandedOverArgs(w.instance, "test-owner")); !out.IsError {
		t.Fatalf("a role without notification.raise raised a notification, want a refusal")
	}
	givesTheRole(t, w, "notification.raise")
	if out := w.mcpCall(t, "agent-chat", "comm_notification_raise", reportHandedOverArgs(w.instance, "test-owner")); out.IsError {
		t.Fatalf("a notification.raise holder raising: %s", toolErrorText(out))
	}
}
