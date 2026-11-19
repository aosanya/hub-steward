package http

import (
	"context"
	"testing"

	mwanachamadigitaltwin "github.com/aosanya/mwanachama-backend-digitaltwin"
)

func TestDigitaltwinNodeTools_ListAndReadServeTheNodes(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "digitaltwin")

	twin, err := w.deps.Registry.TwinManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("twin manager: %v", err)
	}
	plot, err := twin.CreateNode(context.Background(), mwanachamadigitaltwin.Node{Name: "Plot 12", Kind: "place"})
	if err != nil {
		t.Fatalf("seeding a place: %v", err)
	}
	if _, err := twin.CreateNode(context.Background(), mwanachamadigitaltwin.Node{Name: "Plot 14", Kind: "place"}); err != nil {
		t.Fatalf("seeding a second place: %v", err)
	}

	listed := twinStructured(t, w.mcpCall(t, "test-owner", "digitaltwin_node_list", map[string]any{"instance_id": w.instance}))
	items, _ := listed["items"].([]any)
	if len(items) != 2 {
		t.Fatalf("digitaltwin_node_list answered %+v, want the two nodes", listed)
	}

	read := twinStructured(t, w.mcpCall(t, "test-owner", "digitaltwin_node_read", map[string]any{"instance_id": w.instance, "nodeID": plot.ID}))
	if read["id"] != plot.ID || read["name"] != "Plot 12" {
		t.Fatalf("digitaltwin_node_read answered %+v, want %s named Plot 12", read, plot.ID)
	}
}

func TestDigitaltwinNodeTools_ViewHolderReadsAndAHolderOfNoRoleIsRefused(t *testing.T) {
	w := newDesignAgentWalk(t)
	runsModules(t, w.instance, "digitaltwin")

	twin, err := w.deps.Registry.TwinManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("twin manager: %v", err)
	}
	plot, err := twin.CreateNode(context.Background(), mwanachamadigitaltwin.Node{Name: "Plot 12", Kind: "place"})
	if err != nil {
		t.Fatalf("seeding a place: %v", err)
	}

	if out := w.mcpCall(t, "agent-chat", "digitaltwin_node_list", map[string]any{"instance_id": w.instance}); !out.IsError {
		t.Errorf("a holder of no digitaltwin role listed the nodes, want a refusal")
	}

	givesTheRole(t, w, "digitaltwin.view")
	if out := w.mcpCall(t, "agent-chat", "digitaltwin_node_list", map[string]any{"instance_id": w.instance}); out.IsError {
		t.Errorf("a digitaltwin.view holder listing nodes: %s", toolErrorText(out))
	}
	if out := w.mcpCall(t, "agent-chat", "digitaltwin_node_read", map[string]any{"instance_id": w.instance, "nodeID": plot.ID}); out.IsError {
		t.Errorf("a digitaltwin.view holder reading a node: %s", toolErrorText(out))
	}
}
