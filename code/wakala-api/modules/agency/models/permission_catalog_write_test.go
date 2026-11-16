package models

import (
	"slices"
	"testing"
)

func TestPermissionCatalog_ServiceEditAndBoardManageCarryTheCatalogueWrites(t *testing.T) {
	for code, actions := range map[string][]string{
		"service.edit": {"catalog.entry.upsert", "catalog.entry.read"},
		"board.manage": {"catalog.board_item.assign"},
	} {
		p, ok := LookupPermission(code)
		if !ok {
			t.Fatalf("catalogue lacks %s", code)
		}
		for _, a := range actions {
			if !slices.Contains(p.Actions, a) {
				t.Errorf("%s lacks action %s, has %v", code, a, p.Actions)
			}
		}
	}
}
