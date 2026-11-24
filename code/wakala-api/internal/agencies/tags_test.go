package agencies

import (
	"context"
	"errors"
	"testing"
)

func tagNames(tags []Tag) []string {
	names := make([]string, 0, len(tags))
	for _, tag := range tags {
		names = append(names, tag.Name)
	}
	return names
}

func TestNewInstanceListsExactlyTheSystemTagAll(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	tags, err := reg.ListTags(context.Background(), id)
	if err != nil {
		t.Fatalf("ListTags: %v", err)
	}
	if len(tags) != 1 || tags[0].Name != "all" || !tags[0].System || tags[0].ID == "" || tags[0].InstanceID != id {
		t.Fatalf("tags of a new instance: %+v, want only the system tag all", tags)
	}
}

func TestInstanceThatExistedBeforeTheTableListsAllOnFirstRead(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	if err := reg.db.Exec("DELETE FROM agency_tags").Error; err != nil {
		t.Fatalf("clear the tags: %v", err)
	}
	tags, err := reg.ListTags(ctx, id)
	if err != nil {
		t.Fatalf("ListTags: %v", err)
	}
	if len(tags) != 1 || tags[0].Name != "all" || !tags[0].System {
		t.Fatalf("tags after the first read: %+v, want all", tags)
	}
	again, err := reg.ListTags(ctx, id)
	if err != nil || len(again) != 1 || again[0].ID != tags[0].ID {
		t.Fatalf("second read: %+v %v, want the same single tag", again, err)
	}
}

func TestCreatedTagIsListedWithAnIDAndNoSystemFlag(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	made, err := reg.CreateTag(ctx, id, "north")
	if err != nil {
		t.Fatalf("CreateTag: %v", err)
	}
	if made.ID == "" || made.Name != "north" || made.System || made.InstanceID != id {
		t.Fatalf("created tag: %+v", made)
	}
	tags, err := reg.ListTags(ctx, id)
	if err != nil {
		t.Fatalf("ListTags: %v", err)
	}
	if names := tagNames(tags); len(names) != 2 || names[0] != "all" || names[1] != "north" {
		t.Fatalf("tag names: %v, want [all north]", names)
	}
}

func TestSecondTagWithTheSameNameIsRefused(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	if _, err := reg.CreateTag(ctx, id, "north"); err != nil {
		t.Fatalf("CreateTag: %v", err)
	}
	for _, name := range []string{"north", " north ", "North", "all", "ALL"} {
		if _, err := reg.CreateTag(ctx, id, name); !errors.Is(err, ErrTagNameTaken) {
			t.Errorf("create %q: %v, want ErrTagNameTaken", name, err)
		}
	}
	tags, _ := reg.ListTags(ctx, id)
	if len(tags) != 2 {
		t.Fatalf("tags: %v, want two", tagNames(tags))
	}
}

func TestBlankTagNameIsRefused(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	for _, name := range []string{"", "   ", "\t"} {
		if _, err := reg.CreateTag(ctx, id, name); !errors.Is(err, ErrTagInvalid) {
			t.Errorf("create %q: %v, want ErrTagInvalid", name, err)
		}
	}
	made, _ := reg.CreateTag(ctx, id, "north")
	if _, err := reg.RenameTag(ctx, id, made.ID, " "); !errors.Is(err, ErrTagInvalid) {
		t.Errorf("rename to blank: %v, want ErrTagInvalid", err)
	}
}

func TestRenamedTagKeepsItsID(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	made, err := reg.CreateTag(ctx, id, "north")
	if err != nil {
		t.Fatalf("CreateTag: %v", err)
	}
	renamed, err := reg.RenameTag(ctx, id, made.ID, "emea")
	if err != nil {
		t.Fatalf("RenameTag: %v", err)
	}
	if renamed.ID != made.ID || renamed.Name != "emea" {
		t.Fatalf("renamed tag: %+v, want id %s and name emea", renamed, made.ID)
	}
	tags, _ := reg.ListTags(ctx, id)
	if names := tagNames(tags); len(names) != 2 || names[1] != "emea" {
		t.Fatalf("tag names: %v, want [all emea]", names)
	}
}

func TestRenameToAnotherTagsNameIsRefusedAndToItsOwnNameIsAllowed(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	north, _ := reg.CreateTag(ctx, id, "north")
	if _, err := reg.CreateTag(ctx, id, "south"); err != nil {
		t.Fatalf("CreateTag: %v", err)
	}
	if _, err := reg.RenameTag(ctx, id, north.ID, "south"); !errors.Is(err, ErrTagNameTaken) {
		t.Errorf("rename onto south: %v, want ErrTagNameTaken", err)
	}
	if _, err := reg.RenameTag(ctx, id, north.ID, "all"); !errors.Is(err, ErrTagNameTaken) {
		t.Errorf("rename onto all: %v, want ErrTagNameTaken", err)
	}
	same, err := reg.RenameTag(ctx, id, north.ID, "north")
	if err != nil || same.Name != "north" {
		t.Errorf("rename to its own name: %+v %v", same, err)
	}
	recased, err := reg.RenameTag(ctx, id, north.ID, "North")
	if err != nil || recased.Name != "North" {
		t.Errorf("rename to its own name in another case: %+v %v", recased, err)
	}
}

func TestSystemTagAllCannotBeRenamed(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	tags, _ := reg.ListTags(ctx, id)
	if _, err := reg.RenameTag(ctx, id, tags[0].ID, "everyone"); !errors.Is(err, ErrSystemTag) {
		t.Fatalf("rename all: %v, want ErrSystemTag", err)
	}
	after, _ := reg.ListTags(ctx, id)
	if len(after) != 1 || after[0].Name != "all" {
		t.Fatalf("tags after the refused rename: %v", tagNames(after))
	}
}

func TestRenamingAnUnknownTagOrOneOfAnotherInstanceIsRefused(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	other, err := reg.CreateInstance(ctx, "Other")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	foreign, err := reg.CreateTag(ctx, other.ID, "north")
	if err != nil {
		t.Fatalf("CreateTag: %v", err)
	}
	for _, tagID := range []string{"nope", foreign.ID} {
		if _, err := reg.RenameTag(ctx, id, tagID, "emea"); !errors.Is(err, ErrTagNotFound) {
			t.Errorf("rename %q: %v, want ErrTagNotFound", tagID, err)
		}
	}
}

func TestTwoInstancesKeepSeparateTagLists(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	other, err := reg.CreateInstance(ctx, "Other")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	if _, err := reg.CreateTag(ctx, id, "north"); err != nil {
		t.Fatalf("CreateTag in the first: %v", err)
	}
	if _, err := reg.CreateTag(ctx, other.ID, "north"); err != nil {
		t.Fatalf("the same name in the second instance: %v", err)
	}
	if _, err := reg.CreateTag(ctx, other.ID, "south"); err != nil {
		t.Fatalf("CreateTag in the second: %v", err)
	}
	first, _ := reg.ListTags(ctx, id)
	second, _ := reg.ListTags(ctx, other.ID)
	if len(first) != 2 || len(second) != 3 {
		t.Fatalf("first %v, second %v", tagNames(first), tagNames(second))
	}
	if first[0].ID == second[0].ID {
		t.Fatalf("both instances share the id of all: %s", first[0].ID)
	}
}

func TestTagsOfAnUnknownInstanceAreRefused(t *testing.T) {
	reg, _ := registryWithMembers(t, nil)
	ctx := context.Background()
	if _, err := reg.ListTags(ctx, "missing"); !errors.Is(err, ErrInstanceNotFound) {
		t.Errorf("list: %v, want ErrInstanceNotFound", err)
	}
	if _, err := reg.CreateTag(ctx, "missing", "north"); !errors.Is(err, ErrInstanceNotFound) {
		t.Errorf("create: %v, want ErrInstanceNotFound", err)
	}
	if err := reg.db.Exec("SELECT 1 FROM agency_tags WHERE instance_id = ?", "missing").Error; err != nil {
		t.Errorf("the tag table: %v", err)
	}
}
