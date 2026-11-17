package mcp_test

import (
	"testing"

	digitaltwinmcp "wakalaserver/modules/digitaltwin/mcp"
)

func TestOnlyTheNodeListAndNodeReadActionsAreServedOfTheNodes(t *testing.T) {
	cases := map[string]bool{
		"digitaltwin.node.list":       true,
		"digitaltwin.node.read":       true,
		"digitaltwin.node.create":     false,
		"digitaltwin.node.update":     false,
		"digitaltwin.node.match":      false,
		"digitaltwin.node.set_status": false,
		"digitaltwin.link.create":     false,
		"digitaltwin.metric.upsert":   false,
		"digitaltwin.address.list":    true,
		"digitaltwin.tenure.create":   true,
		"digitaltwin.land_use.update": true,
	}
	for action, want := range cases {
		if got := digitaltwinmcp.Served(action); got != want {
			t.Errorf("Served(%q) = %v, want %v", action, got, want)
		}
	}
}
