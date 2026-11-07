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

func TestReleasingAParticipantDropsTheirAnswersAndUnpickedOffers(t *testing.T) {
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
	if err := pm.ReleaseParticipant(ctx, "p-1"); err != nil {
		t.Fatalf("ReleaseParticipant p-1: %v", err)
	}
	if err := pm.ReleaseParticipant(ctx, "p-2"); err != nil {
		t.Fatalf("ReleaseParticipant p-2: %v", err)
	}
	if n := rowsFor(t, db, s, "rsvp", "p-1") + rowsFor(t, db, s, "rsvp", "p-2"); n != 0 {
		t.Fatalf("answers left = %d, want 0", n)
	}
	if _, err := pm.WithdrawOffer(ctx, call.ID, "p-2"); !errors.Is(err, engage.ErrOfferNotFound) {
		t.Fatalf("unpicked offer after release = %v, want ErrOfferNotFound", err)
	}
	if n := rowsFor(t, db, s, "offer", "p-1"); n != 1 {
		t.Fatalf("picked offer rows = %d, want it kept", n)
	}
}

func TestReleasingNobodyIsRefused(t *testing.T) {
	if err := newTestManager(t).ReleaseParticipant(context.Background(), ""); !errors.Is(err, engage.ErrNoResponder) {
		t.Fatalf("ReleaseParticipant empty = %v, want ErrNoResponder", err)
	}
}
