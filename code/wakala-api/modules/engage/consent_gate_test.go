package engage_test

import (
	"context"
	"errors"
	"testing"

	engage "wakalaserver/modules/engage"
	"wakalaserver/modules/shared/consent"
)

type gateFor map[string]error

func (g gateFor) Check(_ context.Context, actorID string) error { return g[actorID] }

func TestAnRSVPNeedsALiveConsent(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}, "p-2": {"g-1"}, "p-3": {"g-1"}}))
	pm.UseConsentGate(gateFor{"p-2": consent.ErrRequired, "p-3": consent.ErrWithdrawn})
	ev, _ := pm.CreatePost(ctx, anEvent())
	if _, err := pm.AnswerRSVP(ctx, engage.RSVP{PostID: ev.ID, ParticipantID: "p-1", Answer: "going"}); err != nil {
		t.Fatalf("consenting RSVP = %v", err)
	}
	if _, err := pm.AnswerRSVP(ctx, engage.RSVP{PostID: ev.ID, ParticipantID: "p-2", Answer: "going"}); !errors.Is(err, engage.ErrConsentRequired) {
		t.Fatalf("RSVP without consent = %v, want ErrConsentRequired", err)
	}
	if _, err := pm.AnswerRSVP(ctx, engage.RSVP{PostID: ev.ID, ParticipantID: "p-3", Answer: "going"}); !errors.Is(err, engage.ErrConsentWithdrawn) {
		t.Fatalf("RSVP after withdrawal = %v, want ErrConsentWithdrawn", err)
	}
}

func TestAnOfferOfHelpNeedsALiveConsent(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}, "p-2": {"g-1"}}))
	pm.UseConsentGate(gateFor{"p-2": consent.ErrRequired})
	call, err := pm.CreatePost(ctx, aCall(2))
	if err != nil {
		t.Fatalf("CreatePost: %v", err)
	}
	if _, err := pm.OfferHelp(ctx, call.ID, "p-1"); err != nil {
		t.Fatalf("consenting offer = %v", err)
	}
	if _, err := pm.OfferHelp(ctx, call.ID, "p-2"); !errors.Is(err, engage.ErrConsentRequired) {
		t.Fatalf("offer without consent = %v, want ErrConsentRequired", err)
	}
}
