package approvals

import (
	"context"
	"errors"
	"testing"
)

func amendmentCount(t *testing.T, a Approval) int {
	t.Helper()
	history, err := amendmentsIn(a.Amendments)
	if err != nil {
		t.Fatal(err)
	}
	return len(history)
}

func TestApprovalDecision_OwnerCannotApproveDraftChangedAfterReading(t *testing.T) {
	ctx := context.Background()
	st := openMisuseStore(t)
	a, err := st.Propose(ctx, "agent-1", "instance_rename", "rename", `{"name":"Synthetic"}`)
	if err != nil {
		t.Fatal(err)
	}
	read, err := st.Get(ctx, a.ID)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := st.Amend(ctx, a.ID, "agent-1", false, "changed", `{"name":"Other"}`); err != nil {
		t.Fatal(err)
	}
	if out, err := st.DecideSeen(ctx, a.ID, "owner-1", StatusApproved, "ok", "", amendmentCount(t, read)); !errors.Is(err, ErrChangedSinceRead) {
		t.Fatalf("approved a draft that changed after it was read: %+v err %v", out, err)
	}
	still, err := st.Get(ctx, a.ID)
	if err != nil || still.Status != StatusPending {
		t.Fatalf("refused decision changed the approval: %+v err %v", still, err)
	}
	if out, err := st.DecideSeen(ctx, a.ID, "owner-1", StatusApproved, "ok", "", amendmentCount(t, still)); err != nil || out.Status != StatusApproved {
		t.Fatalf("approving the version read was refused: %v", err)
	}
}

func TestApprovalDecision_SeenCountIsCheckedWhenPatching(t *testing.T) {
	ctx := context.Background()
	st := openMisuseStore(t)
	a, err := st.Propose(ctx, "agent-1", "instance_rename", "rename", `{"name":"Synthetic"}`)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := st.Amend(ctx, a.ID, "agent-1", false, "changed", ""); err != nil {
		t.Fatal(err)
	}
	if _, err := st.DecideSeen(ctx, a.ID, "owner-1", StatusApproved, "ok", `{"name":"Mine"}`, 0); !errors.Is(err, ErrChangedSinceRead) {
		t.Fatalf("patched approval of a stale read: want ErrChangedSinceRead, got %v", err)
	}
}

func TestApprovalDecision_DecideWithoutACountIsRefusedOnceTheDraftChanged(t *testing.T) {
	ctx := context.Background()
	st := openMisuseStore(t)
	a, err := st.Propose(ctx, "agent-1", "instance_rename", "rename", `{"name":"Synthetic"}`)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := st.Amend(ctx, a.ID, "agent-1", false, "changed", `{"name":"Other"}`); err != nil {
		t.Fatal(err)
	}
	if out, err := st.Decide(ctx, a.ID, "owner-1", StatusApproved, "ok", ""); !errors.Is(err, ErrChangedSinceRead) {
		t.Fatalf("approved an amended draft with no count: %+v err %v", out, err)
	}
	if out, err := st.Decide(ctx, a.ID, "owner-1", StatusRefused, "no", ""); !errors.Is(err, ErrChangedSinceRead) {
		t.Fatalf("refused an amended draft with no count: %+v err %v", out, err)
	}
	still, err := st.Get(ctx, a.ID)
	if err != nil || still.Status != StatusPending {
		t.Fatalf("refused decisions changed the approval: %+v err %v", still, err)
	}
}
