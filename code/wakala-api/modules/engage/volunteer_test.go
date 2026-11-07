package engage_test

import (
	"context"
	"errors"
	"testing"

	engage "wakalaserver/modules/engage"
)

func aCall(needed int) engage.Post {
	return engage.Post{
		Kind:        "volunteer_call",
		Title:       "Stewards wanted",
		GroupIDs:    []string{"g-1"},
		Task:        "Hand out water",
		StartsAt:    "2030-06-01T09:00:00Z",
		NeededCount: needed,
		PostedBy:    "actor-1",
	}
}

func TestAVolunteerCallIsOfferedPickedAndFilled(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}, "p-2": {"g-1"}, "p-3": {"g-1"}}))
	call, _ := pm.CreatePost(ctx, aCall(1))
	o1, err := pm.OfferHelp(ctx, call.ID, "p-1")
	if err != nil || o1.OfferedAt == "" {
		t.Fatalf("OfferHelp = %+v, %v", o1, err)
	}
	again, _ := pm.OfferHelp(ctx, call.ID, "p-1")
	if again.ID != o1.ID {
		t.Fatalf("a second offer = %+v, want the first", again)
	}
	o2, _ := pm.OfferHelp(ctx, call.ID, "p-2")
	picked, err := pm.PickOffer(ctx, engage.Pick{PostID: call.ID, OfferID: o1.ID, PickedBy: "actor-1"})
	if err != nil || picked.ParticipantID != "p-1" || picked.Pick.PickedAt == "" {
		t.Fatalf("PickOffer = %+v, %v", picked, err)
	}
	if _, err := pm.PickOffer(ctx, engage.Pick{PostID: call.ID, OfferID: o2.ID, PickedBy: "actor-1"}); !errors.Is(err, engage.ErrCallFull) {
		t.Fatalf("a pick past the count: err = %v", err)
	}
	filled, err := pm.FillCall(ctx, call.ID, "actor-1")
	if err != nil || filled.Post.State != "filled" || len(filled.ParticipantIDs) != 1 || filled.ParticipantIDs[0] != "p-1" {
		t.Fatalf("FillCall = %+v, %v", filled, err)
	}
	if got, _ := pm.GetPost(ctx, call.ID); got.State != "filled" {
		t.Fatalf("state = %q, want filled", got.State)
	}
	if _, err := pm.OfferHelp(ctx, call.ID, "p-3"); !errors.Is(err, engage.ErrNotAnOpenCall) {
		t.Fatalf("an offer to a filled call: err = %v", err)
	}
}

func TestVolunteerActsAreRefusedWhereTheyDoNotBelong(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}}))
	call, _ := pm.CreatePost(ctx, aCall(2))
	other, _ := pm.CreatePost(ctx, aCall(2))
	ev, _ := pm.CreatePost(ctx, anEvent())
	offer, _ := pm.OfferHelp(ctx, call.ID, "p-1")
	cases := []struct {
		name string
		err  error
		want error
	}{
		{"offer with no caller", second(pm.OfferHelp(ctx, call.ID, "")), engage.ErrNoVolunteer},
		{"offer outside the groups", second(pm.OfferHelp(ctx, call.ID, "p-2")), engage.ErrPostNotFound},
		{"offer to an event", second(pm.OfferHelp(ctx, ev.ID, "p-1")), engage.ErrNotAnOpenCall},
		{"pick by someone else", second(pm.PickOffer(ctx, engage.Pick{PostID: call.ID, OfferID: offer.ID, PickedBy: "p-1"})), engage.ErrNotThePoster},
		{"pick an offer to another call", second(pm.PickOffer(ctx, engage.Pick{PostID: other.ID, OfferID: offer.ID, PickedBy: "actor-1"})), engage.ErrOfferNotFound},
		{"fill by someone else", second(pm.FillCall(ctx, call.ID, "p-1")), engage.ErrNotThePoster},
		{"fill with no caller", second(pm.FillCall(ctx, call.ID, "")), engage.ErrNoPoster},
	}
	for _, c := range cases {
		if !errors.Is(c.err, c.want) {
			t.Errorf("%s: err = %v, want %v", c.name, c.err, c.want)
		}
	}
}

func second[T any](_ T, err error) error { return err }

func TestACallClosesWithFewerPicksAndIsCancelledWithNone(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}}))
	short, _ := pm.CreatePost(ctx, aCall(3))
	o, _ := pm.OfferHelp(ctx, short.ID, "p-1")
	if _, err := pm.PickOffer(ctx, engage.Pick{PostID: short.ID, OfferID: o.ID, PickedBy: "actor-1"}); err != nil {
		t.Fatal(err)
	}
	filled, err := pm.FillCall(ctx, short.ID, "actor-1")
	if err != nil || filled.Post.State != "filled" || len(filled.ParticipantIDs) != 1 {
		t.Fatalf("closing with one of three = %+v, %v", filled, err)
	}
	empty, _ := pm.CreatePost(ctx, aCall(2))
	pm.OfferHelp(ctx, empty.ID, "p-1")
	closed, err := pm.FillCall(ctx, empty.ID, "actor-1")
	if err != nil || closed.Post.State != "cancelled" || len(closed.ParticipantIDs) != 0 {
		t.Fatalf("closing with none picked = %+v, %v", closed, err)
	}
	if got, _ := pm.GetPost(ctx, empty.ID); got.State != "cancelled" {
		t.Fatalf("state = %q, want cancelled", got.State)
	}
}

func TestAVolunteerWithdrawsUntilPickedAndThePosterUnpicks(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}, "p-2": {"g-1"}}))
	call, _ := pm.CreatePost(ctx, aCall(2))
	o1, _ := pm.OfferHelp(ctx, call.ID, "p-1")
	gone, err := pm.WithdrawOffer(ctx, call.ID, "p-1")
	if err != nil || gone.ID != o1.ID {
		t.Fatalf("WithdrawOffer = %+v, %v", gone, err)
	}
	if _, err := pm.WithdrawOffer(ctx, call.ID, "p-1"); !errors.Is(err, engage.ErrOfferNotFound) {
		t.Fatalf("withdrawing twice: err = %v", err)
	}
	if _, err := pm.PickOffer(ctx, engage.Pick{PostID: call.ID, OfferID: o1.ID, PickedBy: "actor-1"}); !errors.Is(err, engage.ErrOfferNotFound) {
		t.Fatalf("picking a withdrawn offer: err = %v", err)
	}
	o2, _ := pm.OfferHelp(ctx, call.ID, "p-2")
	picked, _ := pm.PickOffer(ctx, engage.Pick{PostID: call.ID, OfferID: o2.ID, PickedBy: "actor-1"})
	if _, err := pm.WithdrawOffer(ctx, call.ID, "p-2"); !errors.Is(err, engage.ErrOfferPicked) {
		t.Fatalf("withdrawing a picked offer: err = %v", err)
	}
	if _, err := pm.Unpick(ctx, call.ID, picked.Pick.ID, "p-2"); !errors.Is(err, engage.ErrNotThePoster) {
		t.Fatalf("unpick by someone else: err = %v", err)
	}
	un, err := pm.Unpick(ctx, call.ID, picked.Pick.ID, "actor-1")
	if err != nil || un.ParticipantID != "p-2" {
		t.Fatalf("Unpick = %+v, %v", un, err)
	}
	if _, err := pm.Unpick(ctx, call.ID, picked.Pick.ID, "actor-1"); !errors.Is(err, engage.ErrPickNotFound) {
		t.Fatalf("unpicking twice: err = %v", err)
	}
	if _, err := pm.WithdrawOffer(ctx, call.ID, "p-2"); err != nil {
		t.Fatalf("withdrawing once unpicked: err = %v", err)
	}
	if _, err := pm.WithdrawOffer(ctx, call.ID, ""); !errors.Is(err, engage.ErrNoVolunteer) {
		t.Fatalf("withdraw with no caller: err = %v", err)
	}
}

func TestACallNamesAStartAndAnyEndAfterIt(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	noStart := aCall(1)
	noStart.StartsAt = ""
	backwards := aCall(1)
	backwards.EndsAt = "2030-06-01T08:00:00Z"
	for name, p := range map[string]engage.Post{"no start": noStart, "end before start": backwards} {
		if _, err := pm.CreatePost(ctx, p); !errors.Is(err, engage.ErrInvalidPost) {
			t.Errorf("%s: err = %v, want ErrInvalidPost", name, err)
		}
	}
	window := aCall(1)
	window.EndsAt = "2030-06-01T12:00:00Z"
	if _, err := pm.CreatePost(ctx, window); err != nil {
		t.Fatalf("a call with a window: err = %v", err)
	}
}
