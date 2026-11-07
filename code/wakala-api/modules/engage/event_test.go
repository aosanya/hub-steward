package engage_test

import (
	"context"
	"errors"
	"testing"
	"time"

	engage "wakalaserver/modules/engage"
)

func anEventOnNow() engage.Post {
	ev := anEvent()
	now := time.Now().UTC()
	ev.StartsAt = now.Add(-time.Minute).Format(time.RFC3339)
	ev.EndsAt = now.Add(time.Hour).Format(time.RFC3339)
	ev.TimeZone = "UTC"
	return ev
}

func TestAChangedEventAnswersEveryoneGoing(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}, "p-2": {"g-1"}}))
	ev, _ := pm.CreatePost(ctx, anEvent())
	_, _ = pm.AnswerRSVP(ctx, engage.RSVP{PostID: ev.ID, ParticipantID: "p-1", Answer: "going"})
	_, _ = pm.AnswerRSVP(ctx, engage.RSVP{PostID: ev.ID, ParticipantID: "p-2", Answer: "not_going"})
	ch, err := pm.ChangeEvent(ctx, engage.EventChange{PostID: ev.ID, ChangedBy: "actor-2", Place: "The school"})
	if err != nil || ch.Post.Place != "The school" || ch.Post.StartsAt != ev.StartsAt || len(ch.ParticipantIDs) != 1 || ch.ParticipantIDs[0] != "p-1" {
		t.Fatalf("ChangeEvent = %+v, %v", ch, err)
	}
	got, _ := pm.GetPost(ctx, ev.ID)
	if got.Place != "The school" {
		t.Fatalf("stored place = %q", got.Place)
	}
	if _, err := pm.ChangeEvent(ctx, engage.EventChange{PostID: ev.ID, ChangedBy: "actor-2", EndsAt: "2000-01-01T00:00:00Z"}); !errors.Is(err, engage.ErrInvalidPost) {
		t.Fatalf("backwards change err = %v", err)
	}
	c, err := pm.CancelEvent(ctx, ev.ID, "actor-1")
	if err != nil || c.Post.State != "cancelled" || len(c.ParticipantIDs) != 1 {
		t.Fatalf("CancelEvent = %+v, %v", c, err)
	}
	if _, err := pm.CancelEvent(ctx, ev.ID, "actor-1"); !errors.Is(err, engage.ErrNotAnOpenEvent) {
		t.Fatalf("second cancel err = %v", err)
	}
	if _, err := pm.ChangeEvent(ctx, engage.EventChange{PostID: ev.ID, Place: "x"}); !errors.Is(err, engage.ErrNoPoster) {
		t.Fatalf("no caller err = %v", err)
	}
}

func TestASelfCheckInHoldsOnlyWhileTheEventIsOn(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}}))
	on, _ := pm.CreatePost(ctx, anEventOnNow())
	later, _ := pm.CreatePost(ctx, anEvent())
	a, err := pm.CheckInSelf(ctx, on.ID, "p-1")
	if err != nil || a.CheckedInBy != "p-1" || a.Unticked {
		t.Fatalf("CheckInSelf = %+v, %v", a, err)
	}
	if _, err := pm.CheckInSelf(ctx, later.ID, "p-1"); !errors.Is(err, engage.ErrOutsideEvent) {
		t.Fatalf("before start err = %v", err)
	}
	if _, err := pm.CheckInSelf(ctx, on.ID, "p-2"); !errors.Is(err, engage.ErrPostNotFound) {
		t.Fatalf("outside groups err = %v", err)
	}
	if _, err := pm.CheckInSelf(ctx, on.ID, ""); !errors.Is(err, engage.ErrNoAttendee) {
		t.Fatalf("no caller err = %v", err)
	}
}

func TestAHolderChecksInUnticksAndTicksAgain(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}}))
	on, _ := pm.CreatePost(ctx, anEventOnNow())
	other, _ := pm.CreatePost(ctx, anEvent())
	first, err := pm.CheckIn(ctx, on.ID, "p-1", "holder-1")
	if err != nil || first.CheckedInBy != "holder-1" {
		t.Fatalf("CheckIn = %+v, %v", first, err)
	}
	un, err := pm.Untick(ctx, on.ID, "p-1", "holder-1")
	if err != nil || !un.Unticked || un.ID != first.ID {
		t.Fatalf("Untick = %+v, %v", un, err)
	}
	again, err := pm.CheckIn(ctx, on.ID, "p-1", "holder-1")
	if err != nil || again.Unticked || again.ID != first.ID {
		t.Fatalf("CheckIn again = %+v, %v", again, err)
	}
	if _, err := pm.CheckIn(ctx, other.ID, "p-1", "holder-1"); !errors.Is(err, engage.ErrOutsideEvent) {
		t.Fatalf("another day err = %v", err)
	}
	if _, err := pm.CheckIn(ctx, on.ID, "p-9", "holder-1"); !errors.Is(err, engage.ErrPostNotFound) {
		t.Fatalf("outside groups err = %v", err)
	}
	if _, err := pm.Untick(ctx, on.ID, "p-9", "holder-1"); !errors.Is(err, engage.ErrNotCheckedIn) {
		t.Fatalf("untick nobody err = %v", err)
	}
}
