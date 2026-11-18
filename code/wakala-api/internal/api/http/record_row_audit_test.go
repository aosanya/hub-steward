package http

import (
	"encoding/json"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func (b businessRegisterWalk) addBusinessOverTool(t *testing.T, business, owner string, replaces string) string {
	t.Helper()
	args := map[string]any{
		"instance_id": b.instance,
		"record_code": b.register,
		"answers":     map[string]string{"Business": business, "Owner": owner, "Contact": "front desk"},
	}
	if replaces != "" {
		args["replaces"] = replaces
	}
	out := designAgentWalk{stepRunWalk: b.stepRunWalk}.mcpCall(t, "test-owner", addLiveRecordRowTool, args)
	return createdIDOf(t, out)
}

func (b businessRegisterWalk) auditOf(t *testing.T, subject string) []auditEntryRow {
	t.Helper()
	var out *mcp.CallToolResult = designAgentWalk{stepRunWalk: b.stepRunWalk}.mcpCall(t, "test-owner", "audit_list_entries", map[string]any{"instance_id": b.instance, "subject": subject})
	return auditEntriesOf(t, out)
}

func TestAuditRecordRows_AddingARowLeavesOneEntryWithTheCallerAndTheRowAsSubject(t *testing.T) {
	b := businessRegister(t)
	id := b.addBusinessOverTool(t, "Alpha Bakery", b.alpha, "")

	entries := b.auditOf(t, id)
	if len(entries) != 1 {
		t.Fatalf("one added row left %d audit entries for its id, want 1: %+v", len(entries), entries)
	}
	if entries[0].Actor != "test-owner" || entries[0].Action != "added a row" || entries[0].Subject != id {
		t.Errorf("entry = %+v, want actor test-owner, action %q and the row id as subject", entries[0], "added a row")
	}
}

func TestAuditRecordRows_ACorrectionLeavesItsOwnEntryUnderTheNewRowAndTheAddStaysUnderTheOldOne(t *testing.T) {
	b := businessRegister(t)
	oldID := b.addBusinessOverTool(t, "Alpha Bakery", b.alpha, "")
	newID := b.addBusinessOverTool(t, "Alpha Bakery Ltd", b.alpha, oldID)

	older := b.auditOf(t, oldID)
	if len(older) != 1 || older[0].Action != "added a row" {
		t.Fatalf("entries of the old row = %+v, want the one add", older)
	}
	newer := b.auditOf(t, newID)
	if len(newer) != 1 || newer[0].Action != "corrected a row" || newer[0].Subject != newID {
		t.Fatalf("entries of the corrected row = %+v, want the one correction", newer)
	}
}

func TestAuditRecordRows_ARefusedRowLeavesNoEntry(t *testing.T) {
	b := businessRegister(t)
	args := map[string]any{"instance_id": b.instance, "record_code": b.register, "answers": map[string]string{"Business": "Alpha Bakery"}, "replaces": "no such row"}
	out := designAgentWalk{stepRunWalk: b.stepRunWalk}.mcpCall(t, "test-owner", addLiveRecordRowTool, args)
	if !out.IsError {
		encoded, _ := json.Marshal(out.StructuredContent)
		t.Fatalf("replacing a row that does not exist was accepted: %s", encoded)
	}
	if entries := b.auditOf(t, "no such row"); len(entries) != 0 {
		t.Errorf("a refused row left entries %+v, want none", entries)
	}
}
