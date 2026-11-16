package http

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/agencies"
)

type auditEntryRow struct {
	Actor   string `json:"actor"`
	Action  string `json:"action"`
	Subject string `json:"subject"`
	At      string `json:"at"`
}

func auditEntriesOf(t *testing.T, out *mcp.CallToolResult) []auditEntryRow {
	t.Helper()
	if out.IsError {
		t.Fatalf("audit_list_entries answered with an error: %s", toolErrorText(out))
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	var body struct {
		Items []auditEntryRow `json:"items"`
	}
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatalf("structured content %s does not carry items: %v", encoded, err)
	}
	return body.Items
}

func TestAuditListEntries_OwnerRenamesTheAgencyAndSeesOneEntryForIt(t *testing.T) {
	w := newDesignAgentWalk(t)
	if out := w.mcpCall(t, "test-owner", "instance_rename", map[string]any{"instance_id": w.instance, "name": "Renamed once"}); out.IsError {
		t.Fatalf("owner renaming the agency: %s", toolErrorText(out))
	}

	entries := auditEntriesOf(t, w.mcpCall(t, "test-owner", "audit_list_entries", map[string]any{"instance_id": w.instance}))

	if len(entries) != 1 {
		t.Fatalf("one rename left %d audit entries, want exactly 1: %+v", len(entries), entries)
	}
	entry := entries[0]
	if entry.Actor != "test-owner" {
		t.Errorf("actor = %q, want test-owner", entry.Actor)
	}
	if !strings.Contains(strings.ToLower(entry.Action), "renamed") || !strings.Contains(strings.ToLower(entry.Action), "agency") {
		t.Errorf("action = %q, want words saying the agency was renamed", entry.Action)
	}
	if !strings.Contains(entry.Subject, w.instance) && !strings.Contains(entry.Subject, "Renamed once") {
		t.Errorf("subject = %q, want the agency (its id %q or its new name)", entry.Subject, w.instance)
	}
	if entry.At == "" {
		t.Errorf("entry carries no time")
	}
}

func TestAuditListEntries_TwoRenamesComeBackNewestFirst(t *testing.T) {
	w := newDesignAgentWalk(t)
	for _, name := range []string{"First name", "Second name"} {
		if out := w.mcpCall(t, "test-owner", "instance_rename", map[string]any{"instance_id": w.instance, "name": name}); out.IsError {
			t.Fatalf("owner renaming the agency to %q: %s", name, toolErrorText(out))
		}
	}

	entries := auditEntriesOf(t, w.mcpCall(t, "test-owner", "audit_list_entries", map[string]any{"instance_id": w.instance}))

	if len(entries) != 2 {
		t.Fatalf("two renames left %d audit entries, want 2: %+v", len(entries), entries)
	}
	if entries[0].At < entries[1].At {
		t.Errorf("entries are oldest first: %q then %q", entries[0].At, entries[1].At)
	}
	if !strings.Contains(entries[0].Action+entries[0].Subject, "Second name") {
		t.Errorf("first entry %+v does not describe the latest rename to \"Second name\"", entries[0])
	}
}

func TestAuditListEntries_PersonWithoutTheAuditPermissionIsRefusedInPlainWords(t *testing.T) {
	w := newDesignAgentWalk(t)
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "agent-bare", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember bare agent: %v", err)
	}
	if out := w.mcpCall(t, "test-owner", "instance_rename", map[string]any{"instance_id": w.instance, "name": "Renamed once"}); out.IsError {
		t.Fatalf("owner renaming the agency: %s", toolErrorText(out))
	}

	for _, who := range []string{"agent-chat", "agent-bare"} {
		out := w.mcpCall(t, who, "audit_list_entries", map[string]any{"instance_id": w.instance})
		if !out.IsError {
			t.Errorf("%s listing the audit log: succeeded, want a refusal", who)
			continue
		}
		text := strings.ToLower(toolErrorText(out))
		if !strings.Contains(text, "permission") {
			t.Errorf("%s refused with %q, want plain words naming the missing permission", who, text)
		}
		if strings.Contains(text, "unknown tool") || strings.Contains(text, "not found") {
			t.Errorf("%s refused with %q, want a refusal about permission, not a missing tool", who, text)
		}
	}
}
