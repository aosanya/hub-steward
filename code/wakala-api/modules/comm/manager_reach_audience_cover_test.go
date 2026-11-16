package mwanachamacomm

import (
	"context"
	"errors"
	"testing"

	"wakalaserver/modules/comm/models"
)

func reachFixture(t *testing.T) *cover13Fixture {
	t.Helper()
	f := cover13Setup(t)
	members := map[string]map[string]bool{
		"room-a": {"ann": true, "lead": true, "bob": true},
		"room-b": {"ann": true},
	}
	f.m.UseBelonging(func(_ context.Context, actor, structure string) (bool, error) {
		return members[structure][actor], nil
	})
	f.m.UseLeading(func(_ context.Context, actor, structure string) (bool, error) {
		return actor == "lead", nil
	})
	f.m.UseRoomsOf(func(_ context.Context, actor string) ([]string, error) {
		return []string{"room-a", "room-a", "room-b", "room-z"}, nil
	})
	return f
}

func reasonsByLabel(reach []models.ChatReach) map[string]models.ChatReachReason {
	out := map[string]models.ChatReachReason{}
	for _, r := range reach {
		out[r.Label+"|"+r.StructureID] = r.Reason
	}
	return out
}

func TestChatReachOfAnOutsiderIsAnEmptyListNotAnError(t *testing.T) {
	f := reachFixture(t)
	ctx := context.Background()
	if _, err := f.m.ChatStore.StartThread(ctx, "room-a", "Budget"); err != nil {
		t.Fatal(err)
	}
	reach, err := f.m.ChatReachOf(ctx, "room-a", "stranger")
	if err != nil {
		t.Fatalf("outsider got error %v", err)
	}
	if reach == nil || len(reach) != 0 {
		t.Fatalf("want empty non-nil list, got %#v", reach)
	}
}

func TestChatReachOfShowsALeadsThreadOnlyToLeadsAndItsAsker(t *testing.T) {
	f := reachFixture(t)
	ctx := context.Background()
	if _, err := f.m.ChatStore.StartThread(ctx, "room-a", "Budget"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := f.m.ChatStore.RequestThread(ctx, "room-a", "Parking", "ann", func(models.ChatThread) bool { return false }); err != nil {
		t.Fatal(err)
	}
	if _, err := f.m.ChatStore.MintThread(ctx, "room-a", "general"); err != nil {
		t.Fatal(err)
	}

	lead, err := f.m.ChatReachOf(ctx, "room-a", "lead")
	if err != nil {
		t.Fatal(err)
	}
	if len(lead) != 3 {
		t.Fatalf("lead should reach all three threads, got %d", len(lead))
	}
	got := reasonsByLabel(lead)
	if got["Budget|room-a"] != models.ChatReachLeads || got["Parking|room-a"] != models.ChatReachLeads || got["|room-a"] != models.ChatReachGroup {
		t.Fatalf("lead reasons wrong: %v", got)
	}

	asker, err := f.m.ChatReachOf(ctx, "room-a", "ann")
	if err != nil {
		t.Fatal(err)
	}
	got = reasonsByLabel(asker)
	if len(asker) != 2 || got["Parking|room-a"] != models.ChatReachAsked || got["|room-a"] != models.ChatReachGroup {
		t.Fatalf("asker should see own request and the group thread only: %v", got)
	}

	other, err := f.m.ChatReachOf(ctx, "room-a", "bob")
	if err != nil {
		t.Fatal(err)
	}
	if len(other) != 1 || other[0].Audience != models.ChatAudienceGroup {
		t.Fatalf("a plain member must reach only the group thread: %#v", other)
	}
}

func TestChatReachOfPersonRefusesWithoutRoomsSourceOrPerson(t *testing.T) {
	f := cover13Setup(t)
	if _, err := f.m.ChatReachOfPerson(context.Background(), "ann"); !errors.Is(err, models.ErrChatNotFound) {
		t.Fatalf("no rooms source: want ErrChatNotFound, got %v", err)
	}
	g := reachFixture(t)
	if _, err := g.m.ChatReachOfPerson(context.Background(), ""); !errors.Is(err, models.ErrChatNotFound) {
		t.Fatalf("empty person: want ErrChatNotFound, got %v", err)
	}
}

func TestChatReachOfPersonSkipsRoomsTheyNoLongerBelongToAndDedupes(t *testing.T) {
	f := reachFixture(t)
	ctx := context.Background()
	for _, room := range []string{"room-a", "room-b", "room-z"} {
		if _, err := f.m.ChatStore.MintThread(ctx, room, "general"); err != nil {
			t.Fatal(err)
		}
	}
	reach, err := f.m.ChatReachOfPerson(ctx, "ann")
	if err != nil {
		t.Fatal(err)
	}
	if len(reach) != 2 {
		t.Fatalf("room-a listed twice and room-z not belonged to: want 2 reaches, got %d: %#v", len(reach), reach)
	}
	if reach[0].StructureID != "room-a" || reach[1].StructureID != "room-b" {
		t.Fatalf("rooms must keep the host's order: %#v", reach)
	}
}

func TestChatReachOfPersonInNoRoomIsNotFound(t *testing.T) {
	f := reachFixture(t)
	f.m.UseRoomsOf(func(context.Context, string) ([]string, error) { return []string{"room-z"}, nil })
	if _, err := f.m.ChatReachOfPerson(context.Background(), "ann"); !errors.Is(err, models.ErrChatNotFound) {
		t.Fatalf("want ErrChatNotFound, got %v", err)
	}
}

func TestChatReachOfPersonPassesTheHostErrorThrough(t *testing.T) {
	f := reachFixture(t)
	boom := errors.New("rooms down")
	f.m.UseRoomsOf(func(context.Context, string) ([]string, error) { return nil, boom })
	if _, err := f.m.ChatReachOfPerson(context.Background(), "ann"); !errors.Is(err, boom) {
		t.Fatalf("want host error, got %v", err)
	}
	f.m.UseRoomsOf(func(context.Context, string) ([]string, error) { return []string{"room-a"}, nil })
	f.m.UseBelonging(func(context.Context, string, string) (bool, error) { return false, boom })
	if _, err := f.m.ChatReachOfPerson(context.Background(), "ann"); !errors.Is(err, boom) {
		t.Fatalf("belonging error must surface, got %v", err)
	}
}

func removedTemplate(subjectID string) models.Notification {
	return models.Notification{
		Category: models.CategoryChat, Event: models.EventMessageRemoved,
		SubjectKind: models.SubjectMessage, SubjectID: subjectID,
	}
}

func TestRaiseToAudienceRefusesATemplateThatNamesOneActorOrNoRecord(t *testing.T) {
	f := cover13Setup(t)
	ctx := context.Background()
	f.m.UseAudience(func(context.Context, models.NotificationSubjectKind, string) ([]string, error) {
		return []string{"ann"}, nil
	})
	named := removedTemplate("m1")
	named.ActorID = "ann"
	if _, err := f.m.RaiseToAudience(ctx, named); !errors.Is(err, models.ErrNotificationInvalid) {
		t.Fatalf("a named actor: want ErrNotificationInvalid, got %v", err)
	}
	noSubject := removedTemplate("")
	if _, err := f.m.RaiseToAudience(ctx, noSubject); !errors.Is(err, models.ErrNotificationInvalid) {
		t.Fatalf("no subject id: want ErrNotificationInvalid, got %v", err)
	}
	noKind := removedTemplate("m1")
	noKind.SubjectKind = ""
	if _, err := f.m.RaiseToAudience(ctx, noKind); !errors.Is(err, models.ErrNotificationInvalid) {
		t.Fatalf("no subject kind: want ErrNotificationInvalid, got %v", err)
	}
}

func TestRaiseToAudienceWithoutAnAudienceOrWithAnEmptyOneRaisesNothing(t *testing.T) {
	f := cover13Setup(t)
	ctx := context.Background()
	if _, err := f.m.RaiseToAudience(ctx, removedTemplate("m1")); !errors.Is(err, ErrNotificationNoAudience) {
		t.Fatalf("no audience source: want ErrNotificationNoAudience, got %v", err)
	}
	f.m.UseAudience(func(context.Context, models.NotificationSubjectKind, string) ([]string, error) {
		return []string{"", ""}, nil
	})
	if _, err := f.m.RaiseToAudience(ctx, removedTemplate("m1")); !errors.Is(err, ErrNotificationNoAudience) {
		t.Fatalf("blank-only audience: want ErrNotificationNoAudience, got %v", err)
	}
	boom := errors.New("audience down")
	f.m.UseAudience(func(context.Context, models.NotificationSubjectKind, string) ([]string, error) { return nil, boom })
	if _, err := f.m.RaiseToAudience(ctx, removedTemplate("m1")); !errors.Is(err, boom) {
		t.Fatalf("host error must surface, got %v", err)
	}
}

func TestRaiseToAudienceRejectsAnInvalidTemplateBeforeRaisingAnything(t *testing.T) {
	f := cover13Setup(t)
	ctx := context.Background()
	f.m.UseAudience(func(context.Context, models.NotificationSubjectKind, string) ([]string, error) {
		return []string{"ann"}, nil
	})
	bad := removedTemplate("m1")
	bad.Category = models.CategorySecurity
	if _, err := f.m.RaiseToAudience(ctx, bad); err == nil {
		t.Fatal("an event paired with the wrong category must be refused")
	}
	count, err := f.m.NotificationStore.UnreadCount(ctx, "ann")
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("nothing may be raised on refusal, got %d", count)
	}
}

func TestRaiseToAudienceDedupesRecipientsAndReportsMutedOnesAsMissed(t *testing.T) {
	f := cover13Setup(t)
	ctx := context.Background()
	f.m.UseAudience(func(context.Context, models.NotificationSubjectKind, string) ([]string, error) {
		return []string{"ann", "", "bob", "ann", "cy"}, nil
	})
	if _, err := f.m.NotificationStore.SetPreference(ctx, "bob", models.CategoryChat, true); err != nil {
		t.Fatal(err)
	}
	out, err := f.m.RaiseToAudience(ctx, removedTemplate("m1"))
	if err != nil {
		t.Fatal(err)
	}
	if out.Resolved != 3 {
		t.Fatalf("Resolved should count distinct non-empty recipients: %d", out.Resolved)
	}
	if len(out.Raised) != 2 || out.Raised[0].ActorID != "ann" || out.Raised[1].ActorID != "cy" {
		t.Fatalf("raised wrong: %#v", out.Raised)
	}
	if len(out.Missed) != 1 || out.Missed[0].ActorID != "bob" || !errors.Is(out.Missed[0].Reason, models.ErrNotificationMuted) {
		t.Fatalf("bob muted chat and must be reported missed: %#v", out.Missed)
	}
	if !out.Complete() {
		t.Fatal("every resolved recipient is accounted for, so the raise is complete")
	}
	if n, _ := f.m.NotificationStore.UnreadCount(ctx, "bob"); n != 0 {
		t.Fatalf("muted recipient must have nothing unread, got %d", n)
	}
	if n, _ := f.m.NotificationStore.UnreadCount(ctx, "ann"); n != 1 {
		t.Fatalf("ann must have one unread, got %d", n)
	}
}

func TestAudienceRaiseCompleteIsFalseWhenARecipientIsUnaccountedFor(t *testing.T) {
	r := AudienceRaise{Resolved: 3, Raised: make([]models.Notification, 1), Missed: make([]AudienceMiss, 1)}
	if r.Complete() {
		t.Fatal("two of three accounted for is not complete")
	}
	if !(AudienceRaise{}).Complete() {
		t.Fatal("an empty raise is trivially complete")
	}
}
