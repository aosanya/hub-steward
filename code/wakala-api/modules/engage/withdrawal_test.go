package engage_test

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"gorm.io/gorm"

	engage "wakalaserver/modules/engage"
	"wakalaserver/modules/shared/spec"
)

func rowsFor(t *testing.T, db *gorm.DB, s *spec.Spec, object, participant string) int64 {
	t.Helper()
	o, ok := s.Object(object)
	if !ok {
		t.Fatalf("no object %q", object)
	}
	var n int64
	q := fmt.Sprintf("select count(*) from %s where participant_id = ?", s.TableFor(o))
	if err := db.Raw(q, participant).Scan(&n).Error; err != nil {
		t.Fatalf("count: %v", err)
	}
	return n
}

type withdrawnFixture struct {
	pm    engage.PostManager
	db    *gorm.DB
	spec  *spec.Spec
	event engage.Post
	call  engage.Post
	first engage.Offer
}

func aWithdrawnFixture(t *testing.T) withdrawnFixture {
	t.Helper()
	ctx := context.Background()
	db := openDB(t)
	s, _ := engage.SpecFor("test")
	if err := engage.Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	pm, err := engage.NewPostManager(db, s)
	if err != nil {
		t.Fatalf("NewPostManager: %v", err)
	}
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}, "p-2": {"g-1"}}))
	ev, _ := pm.CreatePost(ctx, anEvent())
	for _, who := range []string{"p-1", "p-2"} {
		if _, err := pm.AnswerRSVP(ctx, engage.RSVP{PostID: ev.ID, ParticipantID: who, Answer: "going"}); err != nil {
			t.Fatalf("AnswerRSVP: %v", err)
		}
	}
	call, _ := pm.CreatePost(ctx, aCall(2))
	first, err := pm.OfferHelp(ctx, call.ID, "p-1")
	if err != nil {
		t.Fatalf("OfferHelp: %v", err)
	}
	if _, err := pm.OfferHelp(ctx, call.ID, "p-2"); err != nil {
		t.Fatalf("OfferHelp: %v", err)
	}
	if _, err := pm.PickOffer(ctx, engage.Pick{PostID: call.ID, OfferID: first.ID, PickedBy: "actor-1"}); err != nil {
		t.Fatalf("PickOffer: %v", err)
	}
	return withdrawnFixture{pm: pm, db: db, spec: s, event: ev, call: call, first: first}
}

func (f withdrawnFixture) going(t *testing.T) []string {
	t.Helper()
	changed, err := f.pm.ChangeEvent(context.Background(), engage.EventChange{PostID: f.event.ID, ChangedBy: "actor-2", Place: "The school"})
	if err != nil {
		t.Fatalf("ChangeEvent: %v", err)
	}
	return changed.ParticipantIDs
}

func TestReleasingAParticipantHidesTheirAnswersAndUnpickedOffersWithoutDeletingThem(t *testing.T) {
	ctx := context.Background()
	f := aWithdrawnFixture(t)
	if got := f.going(t); len(got) != 2 {
		t.Fatalf("going before release = %v, want both", got)
	}
	if err := f.pm.ReleaseParticipant(ctx, "p-1"); err != nil {
		t.Fatalf("ReleaseParticipant p-1: %v", err)
	}
	if err := f.pm.ReleaseParticipant(ctx, "p-2"); err != nil {
		t.Fatalf("ReleaseParticipant p-2: %v", err)
	}
	if got := f.going(t); len(got) != 0 {
		t.Fatalf("going after release = %v, want nobody", got)
	}
	if n := rowsFor(t, f.db, f.spec, "rsvp", "p-1") + rowsFor(t, f.db, f.spec, "rsvp", "p-2"); n != 2 {
		t.Fatalf("stored answers = %d, want both kept", n)
	}
	if n := rowsFor(t, f.db, f.spec, "offer", "p-2"); n != 1 {
		t.Fatalf("stored unpicked offers = %d, want it kept", n)
	}
	if _, err := f.pm.WithdrawOffer(ctx, f.call.ID, "p-2"); !errors.Is(err, engage.ErrOfferNotFound) {
		t.Fatalf("hidden offer withdrawn = %v, want ErrOfferNotFound", err)
	}
	if n := rowsFor(t, f.db, f.spec, "offer", "p-1"); n != 1 {
		t.Fatalf("picked offer rows = %d, want it kept", n)
	}
}

func TestAHiddenOfferCannotBePicked(t *testing.T) {
	ctx := context.Background()
	f := aWithdrawnFixture(t)
	second, err := f.pm.OfferHelp(ctx, f.call.ID, "p-2")
	if err != nil {
		t.Fatalf("OfferHelp: %v", err)
	}
	if err := f.pm.ReleaseParticipant(ctx, "p-2"); err != nil {
		t.Fatalf("ReleaseParticipant: %v", err)
	}
	if _, err := f.pm.PickOffer(ctx, engage.Pick{PostID: f.call.ID, OfferID: second.ID, PickedBy: "actor-1"}); !errors.Is(err, engage.ErrOfferNotFound) {
		t.Fatalf("PickOffer of a hidden offer = %v, want ErrOfferNotFound", err)
	}
}

func TestRestoringAParticipantBringsTheirAnswersAndOffersBack(t *testing.T) {
	ctx := context.Background()
	f := aWithdrawnFixture(t)
	if err := f.pm.ReleaseParticipant(ctx, "p-2"); err != nil {
		t.Fatalf("ReleaseParticipant: %v", err)
	}
	if got := f.going(t); len(got) != 1 || got[0] != "p-1" {
		t.Fatalf("going while hidden = %v, want only p-1", got)
	}
	if err := f.pm.RestoreParticipant(ctx, "p-2"); err != nil {
		t.Fatalf("RestoreParticipant: %v", err)
	}
	if got := f.going(t); len(got) != 2 {
		t.Fatalf("going after restore = %v, want both", got)
	}
	if _, err := f.pm.WithdrawOffer(ctx, f.call.ID, "p-2"); err != nil {
		t.Fatalf("restored offer withdrawn = %v, want it found", err)
	}
}

func TestRestoringNobodyIsRefused(t *testing.T) {
	if err := newTestManager(t).RestoreParticipant(context.Background(), ""); !errors.Is(err, engage.ErrNoResponder) {
		t.Fatalf("RestoreParticipant empty = %v, want ErrNoResponder", err)
	}
}

func TestAnsweringAgainAfterAWithdrawalShowsTheNewAnswer(t *testing.T) {
	ctx := context.Background()
	f := aWithdrawnFixture(t)
	if err := f.pm.ReleaseParticipant(ctx, "p-2"); err != nil {
		t.Fatalf("ReleaseParticipant: %v", err)
	}
	if _, err := f.pm.AnswerRSVP(ctx, engage.RSVP{PostID: f.event.ID, ParticipantID: "p-2", Answer: "going"}); err != nil {
		t.Fatalf("AnswerRSVP: %v", err)
	}
	if got := f.going(t); len(got) != 2 {
		t.Fatalf("going after answering again = %v, want both", got)
	}
	hidden, err := f.pm.ListHidden(ctx, "p-2")
	if err != nil || len(hidden.RSVPs) != 0 {
		t.Fatalf("hidden answers after answering again = %+v (%v), want none", hidden.RSVPs, err)
	}
}

func TestListingHiddenRowsNamesOnlyThatPersonsWithdrawnRows(t *testing.T) {
	ctx := context.Background()
	f := aWithdrawnFixture(t)
	if err := f.pm.ReleaseParticipant(ctx, "p-2"); err != nil {
		t.Fatalf("ReleaseParticipant: %v", err)
	}
	hidden, err := f.pm.ListHidden(ctx, "p-2")
	if err != nil {
		t.Fatalf("ListHidden: %v", err)
	}
	if len(hidden.RSVPs) != 1 || hidden.RSVPs[0].ParticipantID != "p-2" || hidden.RSVPs[0].Answer != "going" || hidden.RSVPs[0].WithdrawnAt == "" {
		t.Fatalf("hidden answers = %+v, want p-2's going answer with a stamp", hidden.RSVPs)
	}
	if len(hidden.Offers) != 1 || hidden.Offers[0].ParticipantID != "p-2" {
		t.Fatalf("hidden offers = %+v, want p-2's offer", hidden.Offers)
	}
	other, err := f.pm.ListHidden(ctx, "p-1")
	if err != nil || len(other.RSVPs) != 0 || len(other.Offers) != 0 {
		t.Fatalf("hidden rows of a person who did not withdraw = %+v (%v), want none", other, err)
	}
	if _, err := f.pm.ListHidden(ctx, ""); !errors.Is(err, engage.ErrNoResponder) {
		t.Fatalf("ListHidden empty = %v, want ErrNoResponder", err)
	}
}

func TestReleasingNobodyIsRefused(t *testing.T) {
	if err := newTestManager(t).ReleaseParticipant(context.Background(), ""); !errors.Is(err, engage.ErrNoResponder) {
		t.Fatalf("ReleaseParticipant empty = %v, want ErrNoResponder", err)
	}
}

func TestOfferingAgainAfterAWithdrawalShowsTheSameOffer(t *testing.T) {
	ctx := context.Background()
	f := aWithdrawnFixture(t)
	before, err := f.pm.OfferHelp(ctx, f.call.ID, "p-2")
	if err != nil {
		t.Fatalf("OfferHelp: %v", err)
	}
	if err := f.pm.ReleaseParticipant(ctx, "p-2"); err != nil {
		t.Fatalf("ReleaseParticipant: %v", err)
	}
	again, err := f.pm.OfferHelp(ctx, f.call.ID, "p-2")
	if err != nil || again.ID != before.ID || again.WithdrawnAt != "" {
		t.Fatalf("offer again = %+v (%v), want the first offer, unmarked", again, err)
	}
	if hidden, _ := f.pm.ListHidden(ctx, "p-2"); len(hidden.Offers) != 0 {
		t.Fatalf("hidden offers after offering again = %+v, want none", hidden.Offers)
	}
}
