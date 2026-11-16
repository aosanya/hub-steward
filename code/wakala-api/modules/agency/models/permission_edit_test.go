package models

import (
	"slices"
	"testing"
)

func TestPermissionCatalog_ListsTheCodesForChangingAPersonAndAPlace(t *testing.T) {
	for code, actions := range map[string][]string{
		"member.edit":   {"actor.actor.set_display_name", "actor.actor.set_attributes"},
		"location.edit": {"assetmanager.location.update"},
	} {
		p, ok := LookupPermission(code)
		if !ok {
			t.Fatalf("catalogue lacks %s", code)
		}
		if p.Locked {
			t.Errorf("%s is locked, want it givable to a role", code)
		}
		for _, a := range actions {
			if !slices.Contains(p.Actions, a) {
				t.Errorf("%s lacks action %s, has %v", code, a, p.Actions)
			}
		}
	}
}
