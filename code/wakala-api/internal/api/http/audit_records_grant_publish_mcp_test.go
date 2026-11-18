package http

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func createdIDOf(t *testing.T, out *mcp.CallToolResult) string {
	t.Helper()
	if out.IsError {
		t.Fatalf("tool answered with an error: %s", toolErrorText(out))
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	var body struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(encoded, &body); err != nil || body.ID == "" {
		t.Fatalf("structured content %s carries no id: %v", encoded, err)
	}
	return body.ID
}

func (w designAgentWalk) auditEntries(t *testing.T) []auditEntryRow {
	t.Helper()
	return auditEntriesOf(t, w.mcpCall(t, "test-owner", "audit_list_entries", map[string]any{"instance_id": w.instance}))
}

func TestAuditRecords_GrantingARoleAddsOneEntryWithTheGrantorAndTheTime(t *testing.T) {
	w := newDesignAgentWalk(t)
	actorID := createdIDOf(t, w.mcpCall(t, "test-owner", "actor_create_actor", map[string]any{"instance_id": w.instance, "display_name": "Kovács Anna"}))
	groupID := createdIDOf(t, w.mcpCall(t, "test-owner", "actor_create_group", map[string]any{"instance_id": w.instance, "name": "Council"}))
	kindID := createdIDOf(t, w.mcpCall(t, "test-owner", "actor_create_role_kind", map[string]any{"instance_id": w.instance, "name": "Chair"}))
	before := time.Now().UTC().Add(-time.Second)

	out := w.mcpCall(t, "test-owner", "actor_grant_role", map[string]any{"instance_id": w.instance, "actor_id": actorID, "group_id": groupID, "kind_id": kindID})
	if out.IsError {
		t.Fatalf("owner granting the role: %s", toolErrorText(out))
	}

	entries := w.auditEntries(t)
	if len(entries) != 1 {
		t.Fatalf("one grant left %d audit entries, want exactly 1: %+v", len(entries), entries)
	}
	entry := entries[0]
	if entry.Actor != "test-owner" {
		t.Errorf("actor = %q, want test-owner", entry.Actor)
	}
	if entry.Action != "granted a role" {
		t.Errorf("action = %q, want %q", entry.Action, "granted a role")
	}
	if entry.Subject != actorID {
		t.Errorf("subject = %q, want the person who received the role (%q)", entry.Subject, actorID)
	}
	at, err := time.Parse(time.RFC3339Nano, entry.At)
	if err != nil {
		t.Fatalf("time %q does not read as an instant: %v", entry.At, err)
	}
	if at.Before(before) || at.After(time.Now().UTC().Add(time.Second)) {
		t.Errorf("time %s is not the moment of the grant", entry.At)
	}
}

func TestAuditRecords_PublishingAFormAddsOneEntryWithThePublisherAndTheTime(t *testing.T) {
	w := newDesignAgentWalk(t)
	formID := createdIDOf(t, w.mcpCall(t, "test-owner", "forms_form_create", map[string]any{"instance_id": w.instance, "title": "Visit survey", "closes_at": "2030-01-01T00:00:00Z"}))
	before := time.Now().UTC().Add(-time.Second)

	out := w.mcpCall(t, "test-owner", "forms_form_publish", map[string]any{"instance_id": w.instance, "form_id": formID})
	if out.IsError {
		t.Fatalf("owner publishing the form: %s", toolErrorText(out))
	}

	entries := w.auditEntries(t)
	if len(entries) != 1 {
		t.Fatalf("one publish left %d audit entries, want exactly 1: %+v", len(entries), entries)
	}
	entry := entries[0]
	if entry.Actor != "test-owner" {
		t.Errorf("actor = %q, want test-owner", entry.Actor)
	}
	if entry.Action != "published a form" {
		t.Errorf("action = %q, want %q", entry.Action, "published a form")
	}
	if entry.Subject != formID {
		t.Errorf("subject = %q, want the form (%q)", entry.Subject, formID)
	}
	at, err := time.Parse(time.RFC3339Nano, entry.At)
	if err != nil {
		t.Fatalf("time %q does not read as an instant: %v", entry.At, err)
	}
	if at.Before(before) || at.After(time.Now().UTC().Add(time.Second)) {
		t.Errorf("time %s is not the moment of the publish", entry.At)
	}
}

func TestAuditRecords_AFailedGrantLeavesNoEntry(t *testing.T) {
	w := newDesignAgentWalk(t)

	out := w.mcpCall(t, "test-owner", "actor_grant_role", map[string]any{"instance_id": w.instance, "actor_id": "missing", "group_id": "missing", "kind_id": "missing"})
	if !out.IsError {
		t.Fatalf("granting a seat to nobody succeeded, want a refusal")
	}

	if entries := w.auditEntries(t); len(entries) != 0 {
		t.Errorf("a refused grant left audit entries: %+v", entries)
	}
}

func TestAuditRecords_RegisteringAPersonInAGroupAddsOneEntryWithTheRegistrarAndThePerson(t *testing.T) {
	w := newDesignAgentWalk(t)
	actorID := createdIDOf(t, w.mcpCall(t, "test-owner", "actor_create_actor", map[string]any{"instance_id": w.instance, "display_name": "Kovács Anna"}))
	groupID := createdIDOf(t, w.mcpCall(t, "test-owner", "actor_create_group", map[string]any{"instance_id": w.instance, "name": "Council"}))
	before := time.Now().UTC().Add(-time.Second)

	out := w.mcpCall(t, "test-owner", "actor_assign_group", map[string]any{"instance_id": w.instance, "actor_id": actorID, "group_id": groupID})
	if out.IsError {
		t.Fatalf("owner registering the person: %s", toolErrorText(out))
	}

	entries := w.auditEntries(t)
	if len(entries) != 1 {
		t.Fatalf("one registration left %d audit entries, want exactly 1: %+v", len(entries), entries)
	}
	entry := entries[0]
	if entry.Actor != "test-owner" {
		t.Errorf("actor = %q, want test-owner", entry.Actor)
	}
	if entry.Action != "registered in a group" {
		t.Errorf("action = %q, want %q", entry.Action, "registered in a group")
	}
	if entry.Subject != actorID {
		t.Errorf("subject = %q, want the person who was registered (%q)", entry.Subject, actorID)
	}
	at, err := time.Parse(time.RFC3339Nano, entry.At)
	if err != nil {
		t.Fatalf("time %q does not read as an instant: %v", entry.At, err)
	}
	if at.Before(before) || at.After(time.Now().UTC().Add(time.Second)) {
		t.Errorf("time %s is not the moment of the registration", entry.At)
	}
}

func TestAuditRecords_ARefusedRegistrationLeavesNoEntry(t *testing.T) {
	w := newDesignAgentWalk(t)

	out := w.mcpCall(t, "test-owner", "actor_assign_group", map[string]any{"instance_id": w.instance, "actor_id": "missing", "group_id": "missing"})
	if !out.IsError {
		t.Fatalf("registering nobody in no group succeeded, want a refusal")
	}

	if entries := w.auditEntries(t); len(entries) != 0 {
		t.Errorf("a refused registration left audit entries: %+v", entries)
	}
}
