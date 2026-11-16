package http

import (
	"strings"
	"testing"
)

type catalogWriteCall struct {
	tool string
	code string
	args func(w designAgentWalk) map[string]any
}

var catalogWriteCalls = []catalogWriteCall{
	{"forms_catalog_entry_upsert", "service.edit", func(w designAgentWalk) map[string]any {
		return map[string]any{"instance_id": w.instance, "slug": "pothole", "name": "Pothole", "summary": "Report a pothole", "doc": "{}"}
	}},
	{"forms_catalog_entry_read", "service.edit", func(w designAgentWalk) map[string]any {
		return map[string]any{"instance_id": w.instance, "slug": "pothole"}
	}},
	{"forms_catalog_board_item_assign", "board.manage", func(w designAgentWalk) map[string]any {
		return map[string]any{"instance_id": w.instance, "boardItemID": "item-1", "assignee_kind": "role", "assignee_id": w.roleID}
	}},
}

func refusedAsUnknown(text string) bool {
	return strings.Contains(text, "instance not found")
}

func TestCatalogWriteCodes_AgentWithoutTheCodeIsRefused(t *testing.T) {
	for _, c := range catalogWriteCalls {
		w := newDesignAgentWalk(t)
		runsModules(t, w.instance, "forms")
		givesTheRole(t, w, "service.read")
		out := w.mcpCall(t, "agent-chat", c.tool, c.args(w))
		if !out.IsError || !refusedAsUnknown(toolErrorText(out)) {
			t.Errorf("an agent without %s calling %s: error=%v %s, want the refusal", c.code, c.tool, out.IsError, toolErrorText(out))
		}
	}
}

func TestCatalogWriteCodes_AgentHoldingTheCodeIsNotRefused(t *testing.T) {
	for _, c := range catalogWriteCalls {
		w := newDesignAgentWalk(t)
		runsModules(t, w.instance, "forms")
		givesTheRole(t, w, c.code)
		out := w.mcpCall(t, "agent-chat", c.tool, c.args(w))
		if out.IsError && refusedAsUnknown(toolErrorText(out)) {
			t.Errorf("an agent holding %s calling %s was refused: %s", c.code, c.tool, toolErrorText(out))
		}
	}
}

func TestCatalogWriteCodes_AgentHoldingServiceEditSavesAndReadsAnEntry(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "forms")
	givesTheRole(t, w, "service.edit")
	args := map[string]any{"instance_id": w.instance, "slug": "pothole", "name": "Pothole", "summary": "Report a pothole", "doc": "{}"}
	if out := w.mcpCall(t, "agent-chat", "forms_catalog_entry_upsert", args); out.IsError {
		t.Fatalf("agent holding service.edit saving an entry: %s", toolErrorText(out))
	}
	read := map[string]any{"instance_id": w.instance, "slug": "pothole"}
	if out := w.mcpCall(t, "agent-chat", "forms_catalog_entry_read", read); out.IsError {
		t.Fatalf("agent holding service.edit reading the entry back: %s", toolErrorText(out))
	}
}
