package models

import (
	"slices"
	"testing"
)

func TestPermissionCatalog_MemberAddCreatesAPersonAndNothingMore(t *testing.T) {
	add, ok := LookupPermission("member.add")
	if !ok {
		t.Fatal("catalogue lacks member.add")
	}
	if !slices.Equal(add.Actions, []string{"actor.actor.create"}) {
		t.Errorf("member.add actions = %v, want only actor.actor.create", add.Actions)
	}
	for _, code := range []string{"member.edit", "member.read", "member.view", "member.invite", "member.remove"} {
		other, found := LookupPermission(code)
		if found && slices.Contains(other.Actions, "actor.actor.create") {
			t.Errorf("%s also holds actor.actor.create, so member.add adds nothing apart from it", code)
		}
	}
}
