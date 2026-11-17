package http

import (
	"regexp"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

var permissionNamedMarker = regexp.MustCompile(`you need (the|a) permission`)

var riskReadTools = []string{
	"riskmanager_risk_list",
	"riskmanager_action_list",
	"riskmanager_assessment_list",
	"riskmanager_barrier_list",
	"riskmanager_evidence_list",
}

func (w groupRoleWalk) createRiskTool(t *testing.T, subject string) *mcp.CallToolResult {
	t.Helper()
	return w.callTool(t, subject, "riskmanager_risk_create", map[string]any{
		"instance_id": w.instance,
		"title":       "Bridge flooding",
		"top_event":   "River floods the footbridge",
	})
}

func TestGroupRoleRisk_AResidentHoldingTheRiskReadPermissionReadsEveryRiskList(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.riskReaderRole(t)
	id, _ := w.resident(t, "Amina", "Analysts")
	w.giveRole(t, "Analysts", riskReaderName)
	for _, tool := range riskReadTools {
		t.Run(tool, func(t *testing.T) {
			out := w.lookup(t, id, tool)
			if out.IsError {
				t.Fatalf("%s: a resident holding %s got %q", tool, riskReadPermission, toolErrorText(out))
			}
		})
	}
}

func TestGroupRoleRisk_AResidentWithNoRoleIsToldWhichPermissionTheRiskToolsNeed(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.riskReaderRole(t)
	id, _ := w.resident(t, "Amina", "Analysts")
	calls := map[string]*mcp.CallToolResult{
		"riskmanager_action_list": w.lookup(t, id, "riskmanager_action_list"),
		"riskmanager_risk_create": w.createRiskTool(t, id),
	}
	for tool, out := range calls {
		t.Run(tool, func(t *testing.T) {
			text := toolErrorText(out)
			if !out.IsError {
				t.Fatalf("%s: a resident with no role was admitted", tool)
			}
			if !permissionNamedMarker.MatchString(text) {
				t.Fatalf("%s: refusal %q names no permission, want a match for %q", tool, text, permissionNamedMarker)
			}
		})
	}
}

func TestGroupRoleRisk_AResidentHoldingOnlyTheRiskReadPermissionIsRefusedTheRiskCreateTool(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.riskReaderRole(t)
	id, _ := w.resident(t, "Amina", "Analysts")
	w.giveRole(t, "Analysts", riskReaderName)
	out := w.createRiskTool(t, id)
	if !out.IsError {
		t.Fatalf("riskmanager_risk_create: a resident holding only %s was admitted", riskReadPermission)
	}
}
