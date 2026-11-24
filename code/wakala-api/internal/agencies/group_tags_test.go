package agencies

import (
	"context"
	"errors"
	"testing"
)

func groupTagNames(t *testing.T, reg *registry, instanceID, groupID string) []string {
	t.Helper()
	tags, err := reg.GroupTags(context.Background(), instanceID, groupID)
	if err != nil {
		t.Fatalf("GroupTags: %v", err)
	}
	return tagNames(tags)
}

func TestGroupWithNoTagListsAnEmptyList(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	tags, err := reg.GroupTags(context.Background(), id, "g1")
	if err != nil {
		t.Fatalf("GroupTags: %v", err)
	}
	if tags == nil || len(tags) != 0 {
		t.Fatalf("tags of a group with none: %#v, want an empty non-nil list", tags)
	}
}

func TestTagGivenToAGroupIsListedForIt(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	north, _ := reg.CreateTag(ctx, id, "north")
	if err := reg.GiveGroupTag(ctx, id, "g1", north.ID); err != nil {
		t.Fatalf("GiveGroupTag: %v", err)
	}
	if names := groupTagNames(t, reg, id, "g1"); len(names) != 1 || names[0] != "north" {
		t.Fatalf("tags of g1: %v, want [north]", names)
	}
	if names := groupTagNames(t, reg, id, "g2"); len(names) != 0 {
		t.Fatalf("tags of g2: %v, want none", names)
	}
}

func TestGivingATagTwiceChangesNothing(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	north, _ := reg.CreateTag(ctx, id, "north")
	for i := 0; i < 2; i++ {
		if err := reg.GiveGroupTag(ctx, id, "g1", north.ID); err != nil {
			t.Fatalf("GiveGroupTag %d: %v", i, err)
		}
	}
	if names := groupTagNames(t, reg, id, "g1"); len(names) != 1 {
		t.Fatalf("tags of g1: %v, want one", names)
	}
}

func TestTakingATagOffAGroupLeavesNoneAndTakingItAgainIsAllowed(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	north, _ := reg.CreateTag(ctx, id, "north")
	south, _ := reg.CreateTag(ctx, id, "south")
	_ = reg.GiveGroupTag(ctx, id, "g1", north.ID)
	_ = reg.GiveGroupTag(ctx, id, "g1", south.ID)
	if err := reg.TakeGroupTag(ctx, id, "g1", north.ID); err != nil {
		t.Fatalf("TakeGroupTag: %v", err)
	}
	if names := groupTagNames(t, reg, id, "g1"); len(names) != 1 || names[0] != "south" {
		t.Fatalf("tags of g1: %v, want [south]", names)
	}
	if err := reg.TakeGroupTag(ctx, id, "g1", north.ID); err != nil {
		t.Fatalf("TakeGroupTag again: %v", err)
	}
	_ = reg.TakeGroupTag(ctx, id, "g1", south.ID)
	if names := groupTagNames(t, reg, id, "g1"); len(names) != 0 {
		t.Fatalf("tags of g1: %v, want none", names)
	}
}

func TestSystemTagAllCanBeGivenToAGroupWithOrWithoutOthers(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	tags, _ := reg.ListTags(ctx, id)
	north, _ := reg.CreateTag(ctx, id, "north")
	if err := reg.GiveGroupTag(ctx, id, "g1", tags[0].ID); err != nil {
		t.Fatalf("give all alone: %v", err)
	}
	if names := groupTagNames(t, reg, id, "g1"); len(names) != 1 || names[0] != "all" {
		t.Fatalf("tags of g1: %v, want [all]", names)
	}
	if err := reg.GiveGroupTag(ctx, id, "g2", north.ID); err != nil {
		t.Fatalf("give north: %v", err)
	}
	if err := reg.GiveGroupTag(ctx, id, "g2", tags[0].ID); err != nil {
		t.Fatalf("give all with another tag: %v", err)
	}
	if names := groupTagNames(t, reg, id, "g2"); len(names) != 2 || names[0] != "all" || names[1] != "north" {
		t.Fatalf("tags of g2: %v, want [all north]", names)
	}
}

func TestTagOfAnotherInstanceCannotBeGivenToAGroup(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	other, err := reg.CreateInstance(ctx, "Other")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	foreign, _ := reg.CreateTag(ctx, other.ID, "north")
	for _, tagID := range []string{foreign.ID, "nope"} {
		if err := reg.GiveGroupTag(ctx, id, "g1", tagID); !errors.Is(err, ErrTagNotFound) {
			t.Errorf("give %q: %v, want ErrTagNotFound", tagID, err)
		}
	}
	if names := groupTagNames(t, reg, id, "g1"); len(names) != 0 {
		t.Fatalf("tags of g1: %v, want none", names)
	}
}

func TestGroupTagWritesRefuseAnyBlankPart(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	north, _ := reg.CreateTag(ctx, id, "north")
	cases := []struct{ instance, group, tag string }{
		{"", "g", north.ID}, {id, "", north.ID}, {id, " ", north.ID}, {id, "g", ""}, {id, "g", "\t"},
	}
	for _, c := range cases {
		if err := reg.GiveGroupTag(ctx, c.instance, c.group, c.tag); !errors.Is(err, ErrGroupTagInvalid) {
			t.Errorf("give %+v: %v, want ErrGroupTagInvalid", c, err)
		}
		if err := reg.TakeGroupTag(ctx, c.instance, c.group, c.tag); !errors.Is(err, ErrGroupTagInvalid) {
			t.Errorf("take %+v: %v, want ErrGroupTagInvalid", c, err)
		}
	}
}

func TestRenamedTagStaysOnItsGroups(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	north, _ := reg.CreateTag(ctx, id, "north")
	_ = reg.GiveGroupTag(ctx, id, "g1", north.ID)
	if _, err := reg.RenameTag(ctx, id, north.ID, "emea"); err != nil {
		t.Fatalf("RenameTag: %v", err)
	}
	if names := groupTagNames(t, reg, id, "g1"); len(names) != 1 || names[0] != "emea" {
		t.Fatalf("tags of g1: %v, want [emea]", names)
	}
}

func TestTwoInstancesKeepTheirGroupTagsApart(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	other, _ := reg.CreateInstance(ctx, "Other")
	north, _ := reg.CreateTag(ctx, id, "north")
	_ = reg.GiveGroupTag(ctx, id, "g1", north.ID)
	if names := groupTagNames(t, reg, other.ID, "g1"); len(names) != 0 {
		t.Fatalf("tags of g1 in the other instance: %v, want none", names)
	}
}
