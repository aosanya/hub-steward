package http

import (
	"context"
	"net/http"
	"testing"
)

func residentHoldingThroughAGroupRole(t *testing.T, codes ...string) changeTarget {
	t.Helper()
	w := newChangeTarget(t)
	runsModules(t, w.instance, "forms")
	held := map[string][]string{w.roles["Volunteer"]: codes}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		return held[roleID], nil
	}
	w.seatThroughAGroupRole(t)
	return w
}

func TestCatalogResidentCodes_ClerkHoldingServiceEditThroughAGroupRoleSavesAndReadsAnEntry(t *testing.T) {
	w := residentHoldingThroughAGroupRole(t, "service.edit")
	args := map[string]any{"instance_id": w.instance, "slug": "pothole", "name": "Pothole", "summary": "Report a pothole", "doc": "{}"}
	if out := w.mcpCall(t, w.volunteer, "forms_catalog_entry_upsert", args); out.IsError {
		t.Fatalf("resident holding service.edit saving an entry: %s", toolErrorText(out))
	}
	read := map[string]any{"instance_id": w.instance, "slug": "pothole"}
	if out := w.mcpCall(t, w.volunteer, "forms_catalog_entry_read", read); out.IsError {
		t.Fatalf("resident holding service.edit reading the entry back: %s", toolErrorText(out))
	}
}

func TestCatalogResidentCodes_ClerkWithoutTheCodeIsRefused(t *testing.T) {
	for _, c := range catalogWriteCalls {
		w := residentHoldingThroughAGroupRole(t, "service.read")
		out := w.mcpCall(t, w.volunteer, c.tool, c.args(w.designAgentWalk))
		if !out.IsError || !refusedAsUnknown(toolErrorText(out)) {
			t.Errorf("a resident without %s calling %s: error=%v %s, want the refusal", c.code, c.tool, out.IsError, toolErrorText(out))
		}
	}
}

func TestCatalogResidentCodes_ClerkHoldingTheOtherCodeIsRefused(t *testing.T) {
	w := residentHoldingThroughAGroupRole(t, "board.manage")
	args := map[string]any{"instance_id": w.instance, "slug": "pothole", "name": "Pothole", "summary": "Report a pothole", "doc": "{}"}
	out := w.mcpCall(t, w.volunteer, "forms_catalog_entry_upsert", args)
	if !out.IsError || !refusedAsUnknown(toolErrorText(out)) {
		t.Errorf("a resident holding only board.manage saving an entry: error=%v %s, want the refusal", out.IsError, toolErrorText(out))
	}
}

func TestCatalogResidentCodes_StrangerFromAnotherAgencyIsRefused(t *testing.T) {
	w := residentHoldingThroughAGroupRole(t, "service.edit", "board.manage")
	if rec := w.call(t, "POST", "/instances", map[string]any{"name": "Elsewhere"}, w.cookieFor(t, "stranger")); rec.Code != http.StatusCreated {
		t.Fatalf("stranger founds their own agency: %d %s", rec.Code, rec.Body.String())
	}
	for _, c := range catalogWriteCalls {
		out := w.mcpCall(t, "stranger", c.tool, c.args(w.designAgentWalk))
		if !out.IsError || !refusedAsUnknown(toolErrorText(out)) {
			t.Errorf("a stranger calling %s: error=%v %s, want the refusal", c.tool, out.IsError, toolErrorText(out))
		}
	}
}
