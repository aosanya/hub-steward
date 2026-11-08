package approvals

import (
	"context"
	"errors"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func openMisuseStore(t *testing.T) *Store {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	st, err := Open(db, "misuse")
	if err != nil {
		t.Fatal(err)
	}
	return st
}

func TestApprovalDecision_OwnerCannotReplayDecidedApproval(t *testing.T) {
	ctx := context.Background()
	st := openMisuseStore(t)
	a, err := st.Propose(ctx, "member-1", "instance_rename", "rename", `{"name":"Synthetic"}`)
	if err != nil {
		t.Fatal(err)
	}
	first, err := st.Decide(ctx, a.ID, "owner-1", StatusApproved, "ok", "")
	if err != nil || first.Status != StatusApproved {
		t.Fatalf("first decision: status %q err %v", first.Status, err)
	}
	if _, err := st.Decide(ctx, a.ID, "owner-1", StatusApproved, "again", ""); !errors.Is(err, ErrAlreadyDecided) {
		t.Fatalf("replayed approve: want ErrAlreadyDecided, got %v", err)
	}
	if _, err := st.Decide(ctx, a.ID, "owner-2", StatusRefused, "flip", ""); !errors.Is(err, ErrAlreadyDecided) {
		t.Fatalf("flipped decision: want ErrAlreadyDecided, got %v", err)
	}
	got, err := st.Get(ctx, a.ID)
	if err != nil || got.Status != StatusApproved || got.DecidedBy != "owner-1" {
		t.Fatalf("stored decision changed: %+v err %v", got, err)
	}
}
