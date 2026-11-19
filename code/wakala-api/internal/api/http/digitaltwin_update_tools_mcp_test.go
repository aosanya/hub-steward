package http

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamadigitaltwin "github.com/aosanya/mwanachama-backend-digitaltwin"
)

func twinStructured(t *testing.T, out *mcp.CallToolResult) map[string]any {
	t.Helper()
	if out.IsError {
		t.Fatalf("digitaltwin tool answered with an error: %s", toolErrorText(out))
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatal(err)
	}
	var body map[string]any
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatalf("structured content %s: %v", encoded, err)
	}
	return body
}

func TestDigitaltwinUpdateTools_ManageHolderUpdatesAndViewHolderIsRefused(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "digitaltwin")

	twin, err := w.deps.Registry.TwinManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("twin manager: %v", err)
	}
	place, err := twin.CreateNode(context.Background(), mwanachamadigitaltwin.Node{Name: "Plot 12", Kind: "place"})
	if err != nil {
		t.Fatalf("seeding a place: %v", err)
	}
	placeID := place.ID

	address := twinStructured(t, w.mcpCall(t, "test-owner", "digitaltwin_address_create", map[string]any{"instance_id": w.instance, "street": "Fő utca", "number": "12"}))
	tenure := twinStructured(t, w.mcpCall(t, "test-owner", "digitaltwin_tenure_create", map[string]any{"instance_id": w.instance, "place_id": placeID, "holder": "amina", "kind": "tenant"}))
	landUse := twinStructured(t, w.mcpCall(t, "test-owner", "digitaltwin_land_use_create", map[string]any{"instance_id": w.instance, "place_id": placeID, "zone": "residential", "use": "housing"}))

	updates := []struct {
		tool    string
		keyName string
		id      any
		changes map[string]any
		field   string
		want    string
	}{
		{"digitaltwin_address_update", "addressID", address["id"], map[string]any{"street": "Fő utca", "number": "14"}, "number", "14"},
		{"digitaltwin_tenure_update", "tenureID", tenure["id"], map[string]any{"place_id": placeID, "holder": "juma", "kind": "owner"}, "holder", "juma"},
		{"digitaltwin_land_use_update", "landUseID", landUse["id"], map[string]any{"place_id": placeID, "zone": "mixed", "use": "shops"}, "zone", "mixed"},
	}
	arguments := func(instance, keyName string, id any, changes map[string]any) map[string]any {
		args := map[string]any{"instance_id": instance, keyName: id}
		for k, v := range changes {
			args[k] = v
		}
		return args
	}

	for _, u := range updates {
		got := twinStructured(t, w.mcpCall(t, "test-owner", u.tool, arguments(w.instance, u.keyName, u.id, u.changes)))
		if got[u.field] != u.want || got["id"] != u.id {
			t.Errorf("%s answered %+v, want %s %q on the same id", u.tool, got, u.field, u.want)
		}
	}

	givesTheRole(t, w, "digitaltwin.view")
	for _, u := range updates {
		if out := w.mcpCall(t, "agent-chat", u.tool, arguments(w.instance, u.keyName, u.id, u.changes)); !out.IsError {
			t.Errorf("a digitaltwin.view holder called %s, want a refusal", u.tool)
		}
	}

	givesTheRole(t, w, "digitaltwin.manage")
	for _, u := range updates {
		if out := w.mcpCall(t, "agent-chat", u.tool, arguments(w.instance, u.keyName, u.id, u.changes)); out.IsError {
			t.Errorf("a digitaltwin.manage holder calling %s: %s", u.tool, toolErrorText(out))
		}
	}
}
