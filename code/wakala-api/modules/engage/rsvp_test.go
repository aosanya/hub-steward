package engage_test

import (
	"context"
	"errors"
	"testing"

	engage "wakalaserver/modules/engage"
)

func TestAnRSVPIsReplacedUntilTheEventStarts(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}}))
	ev, _ := pm.CreatePost(ctx, anEvent())
	first, err := pm.AnswerRSVP(ctx, engage.RSVP{PostID: ev.ID, ParticipantID: "p-1", Answer: "going"})
	if err != nil || first.Answer != "going" || first.AnsweredAt == "" {
		t.Fatalf("AnswerRSVP = %+v, %v", first, err)
	}
	second, err := pm.AnswerRSVP(ctx, engage.RSVP{PostID: ev.ID, ParticipantID: "p-1", Answer: "not_going"})
	if err != nil || second.ID != first.ID || second.Answer != "not_going" {
		t.Fatalf("second AnswerRSVP = %+v, %v", second, err)
	}
}

func TestAnRSVPIsRefusedWhereItDoesNotBelong(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}}))
	ev, _ := pm.CreatePost(ctx, anEvent())
	started := anEvent()
	started.StartsAt, started.EndsAt = "2020-01-01T08:00:00Z", "2020-01-01T12:00:00Z"
	past, _ := pm.CreatePost(ctx, started)
	notice, _ := pm.CreatePost(ctx, aNoticeTo("g-1"))
	cases := []struct {
		name string
		in   engage.RSVP
		want error
	}{
		{"no caller", engage.RSVP{PostID: ev.ID, Answer: "going"}, engage.ErrNoResponder},
		{"bad answer", engage.RSVP{PostID: ev.ID, ParticipantID: "p-1", Answer: "maybe"}, engage.ErrInvalidRSVP},
		{"outside the groups", engage.RSVP{PostID: ev.ID, ParticipantID: "p-2", Answer: "going"}, engage.ErrPostNotFound},
		{"unknown post", engage.RSVP{PostID: "nope", ParticipantID: "p-1", Answer: "going"}, engage.ErrPostNotFound},
		{"a notice", engage.RSVP{PostID: notice.ID, ParticipantID: "p-1", Answer: "going"}, engage.ErrNotAnOpenEvent},
		{"started", engage.RSVP{PostID: past.ID, ParticipantID: "p-1", Answer: "going"}, engage.ErrEventStarted},
	}
	for _, c := range cases {
		if _, err := pm.AnswerRSVP(ctx, c.in); !errors.Is(err, c.want) {
			t.Errorf("%s: err = %v, want %v", c.name, err, c.want)
		}
	}
}
