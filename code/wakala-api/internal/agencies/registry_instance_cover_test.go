package agencies

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestRenameTrimsTheNameAndTheNewNameIsReadBack(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	if _, err := reg.GetInstance(ctx, id); err != nil {
		t.Fatal(err)
	}
	renamed, err := reg.RenameInstance(ctx, id, "  Ward office  ")
	if err != nil || renamed.Name != "Ward office" {
		t.Fatalf("got %+v, %v", renamed, err)
	}
	again, err := reg.GetInstance(ctx, id)
	if err != nil || again.Name != "Ward office" {
		t.Fatalf("a cached read must see the rename: %+v %v", again, err)
	}
}

func TestRenameRefusesBlankAndTooLongNamesCountingCharactersNotBytes(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	for name, value := range map[string]string{"blank": "   ", "empty": "", "121 characters": strings.Repeat("é", MaxInstanceNameLength+1)} {
		if _, err := reg.RenameInstance(ctx, id, value); !errors.Is(err, ErrInvalidInstanceName) {
			t.Errorf("%s: got %v", name, err)
		}
	}
	if _, err := reg.RenameInstance(ctx, id, strings.Repeat("é", MaxInstanceNameLength)); err != nil {
		t.Fatalf("120 characters of two bytes each is allowed: %v", err)
	}
}

func TestRenameAndJoinModeAndKindRefuseAnUnknownInstance(t *testing.T) {
	reg, _ := registryWithMembers(t, nil)
	ctx := context.Background()
	if _, err := reg.RenameInstance(ctx, "ghost", "x"); !errors.Is(err, ErrInstanceNotFound) {
		t.Errorf("rename: %v", err)
	}
	if _, err := reg.SetJoinMode(ctx, "ghost", JoinOpen); !errors.Is(err, ErrInstanceNotFound) {
		t.Errorf("join mode: %v", err)
	}
	if _, err := reg.SetKind(ctx, "ghost", "town"); !errors.Is(err, ErrInstanceNotFound) {
		t.Errorf("kind: %v", err)
	}
}

func TestJoinModeIsOpenOrConfirmedAndChangeIsReadBack(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	if _, err := reg.SetJoinMode(ctx, id, "invite-only"); !errors.Is(err, ErrInvalidJoinMode) {
		t.Fatalf("got %v", err)
	}
	if !ValidJoinMode(JoinOpen) || !ValidJoinMode(JoinConfirmed) || ValidJoinMode("") {
		t.Fatal("ValidJoinMode must accept open and confirmed only")
	}
	opened, err := reg.SetJoinMode(ctx, id, JoinOpen)
	if err != nil || opened.JoinMode != JoinOpen {
		t.Fatalf("got %+v, %v", opened, err)
	}
	read, _ := reg.GetInstance(ctx, id)
	if read.JoinMode != JoinOpen {
		t.Fatalf("the cached instance still says %q", read.JoinMode)
	}
}

func TestKindIsTrimmedAndReadBack(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	set, err := reg.SetKind(context.Background(), id, "  municipality ")
	if err != nil || set.Kind != "municipality" {
		t.Fatalf("got %+v, %v", set, err)
	}
}

func TestInstancesAreListedOldestFirstWithTheirApproval(t *testing.T) {
	reg, first := registryWithMembers(t, nil)
	ctx := context.Background()
	second, err := reg.CreateInstance(ctx, "Second")
	if err != nil {
		t.Fatal(err)
	}
	listed, err := reg.ListInstances(ctx)
	if err != nil || len(listed) != 2 || listed[0].ID != first || listed[1].ID != second.ID {
		t.Fatalf("got %+v, %v", listed, err)
	}
	if listed[0].Approved() {
		t.Fatal("a registry that does not start approved must create pending agencies")
	}
}

func TestCreatingAnInstanceNeedsANameAndRefusesAnEmptyDatabase(t *testing.T) {
	reg, _ := registryWithMembers(t, nil)
	if _, err := reg.CreateInstance(context.Background(), ""); err == nil {
		t.Fatal("an empty name must be refused")
	}
	if _, err := NewRegistry(nil); err == nil {
		t.Fatal("a registry needs a database")
	}
}
