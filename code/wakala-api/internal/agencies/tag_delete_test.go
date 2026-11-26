package agencies

import (
	"context"
	"errors"
	"testing"
)

func TestUnusedTagCanBeDeleted(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	north, _ := reg.CreateTag(ctx, id, "north")
	if err := reg.DeleteTag(ctx, id, north.ID); err != nil {
		t.Fatalf("DeleteTag: %v", err)
	}
	tags, _ := reg.ListTags(ctx, id)
	if names := tagNames(tags); len(names) != 1 || names[0] != "all" {
		t.Fatalf("tags after the delete: %v, want [all]", names)
	}
	if _, err := reg.CreateTag(ctx, id, "north"); err != nil {
		t.Fatalf("the name is free again: %v", err)
	}
}

func TestTagACarriesCannotBeDeletedUntilTakenOff(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	north, _ := reg.CreateTag(ctx, id, "north")
	_ = reg.GiveGroupTag(ctx, id, "g1", north.ID)
	_ = reg.GiveGroupTag(ctx, id, "g2", north.ID)
	err := reg.DeleteTag(ctx, id, north.ID)
	var inUse *TagInUseError
	if !errors.Is(err, ErrTagInUse) || !errors.As(err, &inUse) || inUse.Groups != 2 || inUse.Rows != 0 {
		t.Fatalf("delete a tag two groups carry: %v, want ErrTagInUse with 2 groups", err)
	}
	if tags, _ := reg.ListTags(ctx, id); len(tags) != 2 {
		t.Fatalf("the refused delete removed the tag: %v", tagNames(tags))
	}
	_ = reg.TakeGroupTag(ctx, id, "g1", north.ID)
	_ = reg.TakeGroupTag(ctx, id, "g2", north.ID)
	if err := reg.DeleteTag(ctx, id, north.ID); err != nil {
		t.Fatalf("delete after taking it off: %v", err)
	}
}

func TestTagARowCarriesCannotBeDeleted(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	north, _ := reg.CreateTag(ctx, id, "north")
	carried := map[string]int{north.ID: 3}
	WithTagRowCounter(func(_ context.Context, instanceID, tagID string) (int, error) {
		if instanceID != id {
			t.Errorf("counted rows of instance %q, want %q", instanceID, id)
		}
		return carried[tagID], nil
	})(reg)
	err := reg.DeleteTag(ctx, id, north.ID)
	var inUse *TagInUseError
	if !errors.Is(err, ErrTagInUse) || !errors.As(err, &inUse) || inUse.Rows != 3 || inUse.Groups != 0 {
		t.Fatalf("delete a tag three rows carry: %v, want ErrTagInUse with 3 rows", err)
	}
	carried[north.ID] = 0
	if err := reg.DeleteTag(ctx, id, north.ID); err != nil {
		t.Fatalf("delete once no row carries it: %v", err)
	}
}

func TestRowCounterFailureStopsTheDelete(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	north, _ := reg.CreateTag(ctx, id, "north")
	broken := errors.New("rows unreachable")
	WithTagRowCounter(func(context.Context, string, string) (int, error) { return 0, broken })(reg)
	if err := reg.DeleteTag(ctx, id, north.ID); !errors.Is(err, broken) {
		t.Fatalf("delete with a failing counter: %v, want the counter's error", err)
	}
	if tags, _ := reg.ListTags(ctx, id); len(tags) != 2 {
		t.Fatalf("the tag was deleted without knowing its rows: %v", tagNames(tags))
	}
}

func TestSystemTagAllCannotBeDeleted(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	tags, _ := reg.ListTags(ctx, id)
	if err := reg.DeleteTag(ctx, id, tags[0].ID); !errors.Is(err, ErrSystemTag) {
		t.Fatalf("delete all: %v, want ErrSystemTag", err)
	}
	if after, _ := reg.ListTags(ctx, id); len(after) != 1 {
		t.Fatalf("tags after the refused delete: %v", tagNames(after))
	}
}

func TestDeletingAnUnknownTagOrOneOfAnotherInstanceIsRefused(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	other, _ := reg.CreateInstance(ctx, "Other")
	foreign, _ := reg.CreateTag(ctx, other.ID, "north")
	for _, tagID := range []string{"nope", foreign.ID} {
		if err := reg.DeleteTag(ctx, id, tagID); !errors.Is(err, ErrTagNotFound) {
			t.Errorf("delete %q: %v, want ErrTagNotFound", tagID, err)
		}
	}
	if tags, _ := reg.ListTags(ctx, other.ID); len(tags) != 2 {
		t.Fatalf("the other instance lost a tag: %v", tagNames(tags))
	}
}

func TestTagABacklogCarriesCannotBeDeleted(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	north, _ := reg.CreateTag(ctx, id, "north")
	carried := map[string]int{north.ID: 2}
	WithTagBacklogCounter(func(_ context.Context, instanceID, tagID string) (int, error) {
		if instanceID != id {
			t.Errorf("counted backlogs of instance %q, want %q", instanceID, id)
		}
		return carried[tagID], nil
	})(reg)
	err := reg.DeleteTag(ctx, id, north.ID)
	var inUse *TagInUseError
	if !errors.Is(err, ErrTagInUse) || !errors.As(err, &inUse) || inUse.Backlogs != 2 || inUse.Rows != 0 || inUse.Groups != 0 {
		t.Fatalf("delete a tag two backlogs carry: %v, want ErrTagInUse with 2 backlogs", err)
	}
	carried[north.ID] = 0
	if err := reg.DeleteTag(ctx, id, north.ID); err != nil {
		t.Fatalf("delete once no backlog carries it: %v", err)
	}
}

func TestBacklogCounterFailureStopsTheDelete(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	north, _ := reg.CreateTag(ctx, id, "north")
	broken := errors.New("backlogs unreachable")
	WithTagBacklogCounter(func(context.Context, string, string) (int, error) { return 0, broken })(reg)
	if err := reg.DeleteTag(ctx, id, north.ID); !errors.Is(err, broken) {
		t.Fatalf("delete with a failing counter: %v, want the counter's error", err)
	}
	if tags, _ := reg.ListTags(ctx, id); len(tags) != 2 {
		t.Fatalf("the tag was deleted without knowing its backlogs: %v", tagNames(tags))
	}
}
