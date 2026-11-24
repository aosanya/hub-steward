package http

import (
	"net/http"
	"strings"
	"testing"
)

func TestAuditListEntries_AgentWhoseRoleHoldsTheAuditPermissionReadsTheLog(t *testing.T) {
	w := newDesignAgentWalk(t)
	if rec := w.call(t, "PATCH", w.base+"/roles/"+w.roleID, map[string]any{"name": "Volunteer", "permissions": []string{"audit.view"}}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner gives the role audit.view: %d %s, want 200", rec.Code, rec.Body.String())
	}
	w.publish(t)

	if entries := auditEntriesOf(t, w.mcpCall(t, "agent-chat", "audit_list_entries", map[string]any{"instance_id": w.instance})); len(entries) != 0 {
		t.Errorf("a fresh agency lists %d audit entries, want none: %+v", len(entries), entries)
	}
}

func TestAuditListEntries_PersonOutsideTheAgencyIsRefusedLikeAnUnknownAgency(t *testing.T) {
	w := newDesignAgentWalk(t)

	out := w.mcpCall(t, "stranger", "audit_list_entries", map[string]any{"instance_id": w.instance})

	if !out.IsError {
		t.Fatalf("a stranger listing the audit log succeeded, want a refusal")
	}
	if strings.Contains(strings.ToLower(toolErrorText(out)), "permission") {
		t.Errorf("stranger was told %q, which confirms the agency exists", toolErrorText(out))
	}
}
