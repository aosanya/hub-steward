package agencies

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestJoiningNeedsAnInstanceAndACallerAndAShortMessage(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	if _, err := reg.Join(ctx, "", "u", ""); err == nil {
		t.Error("no instance must be refused")
	}
	if _, err := reg.Join(ctx, id, "  ", ""); err == nil {
		t.Error("no caller must be refused")
	}
	if _, err := reg.Join(ctx, id, "u", strings.Repeat("é", MaxJoinMessageLength+1)); !errors.Is(err, ErrJoinMessageTooLong) {
		t.Errorf("a 501-character message: %v", err)
	}
	if _, err := reg.Join(ctx, "ghost", "u", ""); !errors.Is(err, ErrInstanceNotFound) {
		t.Errorf("unknown instance: %v", err)
	}
}

func TestJoiningAnOpenAgencyMakesTheCallerAResidentAtOnce(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	if _, err := reg.SetJoinMode(ctx, id, JoinOpen); err != nil {
		t.Fatal(err)
	}
	out, err := reg.Join(ctx, id, "amani", "")
	if err != nil || out.Status != JoinedNow || out.Role != RoleResident {
		t.Fatalf("got %+v, %v", out, err)
	}
	if role, _ := reg.RoleOf(ctx, id, "amani"); role != RoleResident {
		t.Fatalf("role %q", role)
	}
	again, err := reg.Join(ctx, id, "amani", "")
	if err != nil || again.Status != AlreadyAMember || again.Role != RoleResident {
		t.Fatalf("a second join must say already a member: %+v %v", again, err)
	}
}

func TestJoiningAConfirmedAgencyQueuesARequestTheManagerCanSee(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	out, err := reg.Join(ctx, id, "amani", "  I live on Mlima road ")
	if err != nil || out.Status != JoinRequested || out.Appeal {
		t.Fatalf("got %+v, %v", out, err)
	}
	pending, err := reg.JoinRequests(ctx, id)
	if err != nil || len(pending) != 1 || pending[0].UserID != "amani" || pending[0].Message != "I live on Mlima road" || pending[0].Status != RequestPending {
		t.Fatalf("got %+v, %v", pending, err)
	}
	if role, _ := reg.RoleOf(ctx, id, "amani"); role != "" {
		t.Fatalf("a request grants no role, got %q", role)
	}
}

func TestAskingAgainAfterARefusalIsAnAppealAndReplacesTheMessage(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	reg.Join(ctx, id, "amani", "first")
	if err := reg.DecideJoinRequest(ctx, id, "amani", false); err != nil {
		t.Fatal(err)
	}
	if pending, _ := reg.JoinRequests(ctx, id); len(pending) != 0 {
		t.Fatalf("a refused request leaves the pending list: %+v", pending)
	}
	out, err := reg.Join(ctx, id, "amani", "second")
	if err != nil || out.Status != JoinRequested || !out.Appeal {
		t.Fatalf("got %+v, %v", out, err)
	}
	pending, _ := reg.JoinRequests(ctx, id)
	if len(pending) != 1 || !pending[0].Appeal || pending[0].Message != "second" {
		t.Fatalf("got %+v", pending)
	}
	if out, _ := reg.Join(ctx, id, "amani", "third"); !out.Appeal {
		t.Fatal("an appeal stays an appeal when asked again")
	}
}

func TestApprovingARequestMakesAResidentAndAskingTwiceIsNotFound(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	reg.Join(ctx, id, "amani", "")
	if err := reg.DecideJoinRequest(ctx, id, "amani", true); err != nil {
		t.Fatal(err)
	}
	if role, _ := reg.RoleOf(ctx, id, "amani"); role != RoleResident {
		t.Fatalf("role %q", role)
	}
	if err := reg.DecideJoinRequest(ctx, id, "amani", true); !errors.Is(err, ErrJoinRequestNotFound) {
		t.Errorf("deciding twice: %v", err)
	}
	if err := reg.DecideJoinRequest(ctx, id, "nobody", false); !errors.Is(err, ErrJoinRequestNotFound) {
		t.Errorf("refusing a stranger: %v", err)
	}
}

func TestARefusedRequestCannotBeApprovedUntilItIsAppealed(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	reg.Join(ctx, id, "amani", "")
	reg.DecideJoinRequest(ctx, id, "amani", false)
	if err := reg.DecideJoinRequest(ctx, id, "amani", true); !errors.Is(err, ErrJoinRequestNotFound) {
		t.Fatalf("got %v", err)
	}
	if err := reg.DecideJoinRequest(ctx, id, "amani", false); !errors.Is(err, ErrJoinRequestNotFound) {
		t.Fatalf("refusing again: %v", err)
	}
}

func TestAdmittingAResidentSkipsTheQueueAndClearsAPendingRequest(t *testing.T) {
	reg, id := registryWithMembers(t, map[string]string{"boss": RoleOwner})
	ctx := context.Background()
	reg.Join(ctx, id, "amani", "")
	role, err := reg.AdmitResident(ctx, id, "amani")
	if err != nil || role != RoleResident {
		t.Fatalf("got %q, %v", role, err)
	}
	if pending, _ := reg.JoinRequests(ctx, id); len(pending) != 0 {
		t.Fatalf("admitting must clear the request: %+v", pending)
	}
	if role, err := reg.AdmitResident(ctx, id, "boss"); err != nil || role != RoleOwner {
		t.Fatalf("an existing operator keeps the role: %q %v", role, err)
	}
	if _, err := reg.AdmitResident(ctx, id, " "); err == nil {
		t.Error("no caller must be refused")
	}
	if _, err := reg.AdmitResident(ctx, "ghost", "u"); !errors.Is(err, ErrInstanceNotFound) {
		t.Errorf("unknown instance: %v", err)
	}
}

func TestLeavingRemovesAResidentButNeverAnOperatorOrAStranger(t *testing.T) {
	reg, id := registryWithMembers(t, map[string]string{"boss": RoleOwner, "amani": RoleResident})
	ctx := context.Background()
	if err := reg.Leave(ctx, id, "amani"); err != nil {
		t.Fatal(err)
	}
	if role, _ := reg.RoleOf(ctx, id, "amani"); role != "" {
		t.Fatalf("role after leaving %q", role)
	}
	if err := reg.Leave(ctx, id, "boss"); !errors.Is(err, ErrOperatorCannotLeave) {
		t.Errorf("operator: %v", err)
	}
	if err := reg.Leave(ctx, id, "stranger"); !errors.Is(err, ErrNothingToLeave) {
		t.Errorf("stranger: %v", err)
	}
}

func TestLeavingWithdrawsAFreshRequestButKeepsAnAppealAsRefused(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	reg.Join(ctx, id, "fresh", "")
	if err := reg.Leave(ctx, id, "fresh"); err != nil {
		t.Fatal(err)
	}
	if err := reg.Leave(ctx, id, "fresh"); !errors.Is(err, ErrNothingToLeave) {
		t.Fatalf("the request is gone: %v", err)
	}
	reg.Join(ctx, id, "appeals", "")
	reg.DecideJoinRequest(ctx, id, "appeals", false)
	reg.Join(ctx, id, "appeals", "again")
	if err := reg.Leave(ctx, id, "appeals"); err != nil {
		t.Fatal(err)
	}
	if pending, _ := reg.JoinRequests(ctx, id); len(pending) != 0 {
		t.Fatalf("a withdrawn appeal is no longer pending: %+v", pending)
	}
	out, _ := reg.Join(ctx, id, "appeals", "once more")
	if !out.Appeal {
		t.Fatal("the withdrawn appeal stays on record as refused, so asking again is still an appeal")
	}
}
