package models

import (
	"slices"
	"testing"
)

func TestPermissionCatalog_MemberRemoveNamesTheRealRemovalActions(t *testing.T) {
	requirePermissionCarries(t, "member.remove", "actor.role_assignment.revoke", "actor.role_assignment.end_on_eviction")
}

func TestPermissionCatalog_MemberRemoveNoLongerNamesTheActionWithNoRoute(t *testing.T) {
	p, _ := LookupPermission("member.remove")
	if slices.Contains(p.Actions, "actor.assignment.delete") {
		t.Errorf("member.remove still names actor.assignment.delete: %v", p.Actions)
	}
}
