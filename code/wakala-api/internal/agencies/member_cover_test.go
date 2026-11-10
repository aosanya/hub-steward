package agencies

import (
	"context"
	"testing"
)

func TestAddingAMemberNeedsBothIdsAndTheInstanceToExist(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	if err := reg.AddMember(ctx, "", "u", RoleOwner); err == nil {
		t.Error("no instance")
	}
	if err := reg.AddMember(ctx, id, "  ", RoleOwner); err == nil {
		t.Error("no user")
	}
	if err := reg.AddMember(ctx, "ghost", "u", RoleOwner); err == nil {
		t.Error("unknown instance")
	}
}

func TestAMemberWithNoRoleIsAnAgentAndAddingAgainChangesTheRole(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	if err := reg.AddMember(ctx, id, " ana ", ""); err != nil {
		t.Fatal(err)
	}
	if role, _ := reg.RoleOf(ctx, id, "ana"); role != RoleAgent {
		t.Fatalf("role %q", role)
	}
	if err := reg.AddMember(ctx, id, "ana", RoleOwner); err != nil {
		t.Fatal(err)
	}
	if role, _ := reg.RoleOf(ctx, id, "ana"); role != RoleOwner {
		t.Fatalf("a second add must change the role, got %q", role)
	}
	members, err := reg.Members(ctx, id)
	if err != nil || len(members) != 1 {
		t.Fatalf("one person is one member: %+v %v", members, err)
	}
}

func TestOnlyOperatorsAreMembersAndBlankIdsAreNobody(t *testing.T) {
	reg, id := registryWithMembers(t, map[string]string{"boss": RoleOwner, "helper": RoleAgent, "amani": RoleResident})
	ctx := context.Background()
	for user, want := range map[string]bool{"boss": true, "helper": true, "amani": false, "stranger": false, "": false} {
		got, err := reg.IsMember(ctx, id, user)
		if err != nil || got != want {
			t.Errorf("%q: got %v, %v", user, got, err)
		}
	}
	if got, _ := reg.IsMember(ctx, "", "boss"); got {
		t.Error("no instance means no member")
	}
	if role, err := reg.RoleOf(ctx, "", "boss"); err != nil || role != "" {
		t.Errorf("blank instance: %q %v", role, err)
	}
}

func TestRemovingAMemberTakesTheRoleAway(t *testing.T) {
	reg, id := registryWithMembers(t, map[string]string{"boss": RoleOwner, "helper": RoleAgent})
	ctx := context.Background()
	if err := reg.RemoveMember(ctx, id, "helper"); err != nil {
		t.Fatal(err)
	}
	if role, _ := reg.RoleOf(ctx, id, "helper"); role != "" {
		t.Fatalf("role %q", role)
	}
	if role, _ := reg.RoleOf(ctx, id, "boss"); role != RoleOwner {
		t.Fatalf("the others are untouched: %q", role)
	}
}

func TestInstancesForListsTheOperatorsAgenciesAndMembershipsListResidentsToo(t *testing.T) {
	reg, first := registryWithMembers(t, map[string]string{"ana": RoleAgent})
	ctx := context.Background()
	second, _ := reg.CreateInstance(ctx, "Second")
	reg.AddMember(ctx, second.ID, "ana", RoleResident)

	operated, err := reg.InstancesFor(ctx, "ana")
	if err != nil || len(operated) != 1 || operated[0].ID != first {
		t.Fatalf("got %+v, %v", operated, err)
	}
	all, err := reg.MembershipsFor(ctx, "ana")
	if err != nil || len(all) != 2 || all[0].Role != RoleAgent || all[1].Role != RoleResident || all[1].Instance.ID != second.ID {
		t.Fatalf("got %+v, %v", all, err)
	}
	if none, err := reg.MembershipsFor(ctx, "  "); err != nil || none == nil || len(none) != 0 {
		t.Fatalf("a blank person has no memberships: %#v %v", none, err)
	}
}

func TestMembersAreListedOldestFirstWithTheirRole(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	reg.AddMember(ctx, id, "first", RoleOwner)
	reg.AddMember(ctx, id, "second", RoleResident)
	members, err := reg.Members(ctx, id)
	if err != nil || len(members) != 2 || members[0].UserID != "first" || members[1].Role != RoleResident {
		t.Fatalf("got %+v, %v", members, err)
	}
	if empty, _ := reg.Members(ctx, "ghost"); empty == nil || len(empty) != 0 {
		t.Fatalf("an unknown agency has no members: %#v", empty)
	}
}
