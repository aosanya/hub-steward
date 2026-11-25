package http

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

func (w stepRunWalk) endSeatsIn(t *testing.T, actorID, groupID string) {
	t.Helper()
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	seats, err := um.ListRoleAssignmentsForActor(ctx, actorID, true)
	if err != nil {
		t.Fatalf("ListRoleAssignmentsForActor: %v", err)
	}
	for _, seat := range seats {
		if seat.GroupID == groupID {
			if err := um.RevokeRole(ctx, seat.ID); err != nil {
				t.Fatalf("RevokeRole: %v", err)
			}
		}
	}
}

func (w assumedGroupWalk) assumedInSession(t *testing.T, sessionKey, member string) string {
	t.Helper()
	ctx := agencies.WithLoginSession(context.Background(), sessionKey)
	got, err := agencies.AssumedGroupOfCaller(ctx, w.deps.Registry, w.instance, member)
	if err != nil {
		t.Fatalf("AssumedGroupOfCaller: %v", err)
	}
	return got
}

func (w assumedGroupWalk) storedChoice(t *testing.T, sessionKey, member, groupID string) {
	t.Helper()
	store, ok := w.deps.Registry.(agencies.AssumedGroups)
	if !ok {
		t.Fatal("the registry does not keep assumed groups")
	}
	if err := store.AssumeGroup(context.Background(), sessionKey, w.instance, member, groupID, time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("AssumeGroup: %v", err)
	}
}

func TestAssumedGroupSeat_ThePersonWhoseSeatEndedReadsNoGroupAndReadsItAgainWhenReseated(t *testing.T) {
	w := newAssumedGroupWalk(t)
	store, _ := w.deps.Registry.(agencies.AssumedGroups)
	ctx := context.Background()
	w.storedChoice(t, "cookie:seated", w.person, w.fieldGroup)

	if got := w.assumedInSession(t, "cookie:seated", w.person); got != w.fieldGroup {
		t.Fatalf("while the seat holds the read is %q, want Field", got)
	}
	w.endSeatsIn(t, w.person, w.fieldGroup)
	if got, err := store.AssumedGroupOf(ctx, "cookie:seated", w.instance, w.person); err != nil || got != "" {
		t.Fatalf("AssumedGroupOf after the seat ended: %q %v, want none", got, err)
	}
	if got := w.assumedInSession(t, "cookie:seated", w.person); got != "" {
		t.Fatalf("AssumedGroupOfCaller after the seat ended: %q, want none", got)
	}
	if got := w.assumedInSession(t, "cookie:seated", w.person); got != "" {
		t.Fatalf("a second request after the seat ended: %q, want none", got)
	}

	w.seat(t, w.person, w.fieldGroup)
	if got := w.assumedInSession(t, "cookie:seated", w.person); got != w.fieldGroup {
		t.Fatalf("after the person is seated again the read is %q, want Field", got)
	}
}

func TestAssumedGroupSeat_ASeatInAnotherGroupDoesNotKeepTheStoredGroup(t *testing.T) {
	w := newAssumedGroupWalk(t)
	w.storedChoice(t, "cookie:other", w.person, w.fieldGroup)

	w.endSeatsIn(t, w.person, w.fieldGroup)
	if got := w.assumedInSession(t, "cookie:other", w.person); got != "" {
		t.Fatalf("a person still seated in Staff reads %q for Field, want none", got)
	}
}

func TestAssumedGroupSeat_AChoiceEndedByItsWindowStaysNoneEvenWhenReseated(t *testing.T) {
	w := newAssumedGroupWalk(t)
	store, _ := w.deps.Registry.(agencies.AssumedGroups)
	if err := store.AssumeGroup(context.Background(), "cookie:window", w.instance, w.person, w.fieldGroup, time.Now().Add(-time.Minute)); err != nil {
		t.Fatalf("AssumeGroup: %v", err)
	}
	if got := w.assumedInSession(t, "cookie:window", w.person); got != "" {
		t.Fatalf("a choice past its window reads %q with the seat held, want none", got)
	}
}

func TestAssumedGroupSeat_AKeySessionOfAnAgentMemberBehavesTheSame(t *testing.T) {
	w := newAssumedGroupWalk(t).withKeys(t)
	token, member := w.agencyKey(t)
	w.seat(t, member, w.fieldGroup)
	if rec := w.bearer(t, "PUT", "my-group", token, map[string]any{"group_id": w.fieldGroup}); rec.Code != http.StatusOK {
		t.Fatalf("the agency key assumes Field: %d %s, want 200", rec.Code, rec.Body.String())
	}
	session := keySessionKeyPrefix + strings.TrimPrefix(member, "agency-key-")

	if got := w.assumedInSession(t, session, member); got != w.fieldGroup {
		t.Fatalf("the key session reads %q while seated, want Field", got)
	}
	w.endSeatsIn(t, member, w.fieldGroup)
	if got := w.assumedInSession(t, session, member); got != "" {
		t.Fatalf("the key session reads %q after the seat ended, want none", got)
	}
	if got := w.keyAssumed(t, token); got != nil {
		t.Fatalf("the key reads %v on my-group after the seat ended, want none", got)
	}
	w.seat(t, member, w.fieldGroup)
	if got := w.keyAssumed(t, token); got != w.fieldGroup {
		t.Fatalf("the key reads %v once the member is seated again, want Field", got)
	}
}

func TestAssumedGroupSeat_TheRowReachOfAPersonWhoseSeatEndedIsEmpty(t *testing.T) {
	w := newReachWalk(t)
	group := w.groupCarrying(t, "EMEA", "emea")
	as := w.callerIn(t, "emea-coordinator", "Coordinator", group)
	ctx := agencies.WithLoginSession(accounts.WithID(context.Background(), "emea-coordinator"), cookieSessionKeyOf(as.Value))
	reachOf := func() rowReach {
		reach, err := w.deps.rowReachOfCaller(ctx, w.instance)
		if err != nil {
			t.Fatalf("rowReachOfCaller: %v", err)
		}
		return reach
	}

	if reach := reachOf(); reach.reachesNoRow() {
		t.Fatalf("a seated person reaches no row: %+v", reach)
	}
	w.endSeatsIn(t, "emea-coordinator", group)
	if reach := reachOf(); !reach.reachesNoRow() {
		t.Fatalf("after the seat ended the person reaches %+v, want no row", reach)
	}
	w.grantSeat(t, "emea-coordinator", group, w.roles["Coordinator"])
	if reach := reachOf(); reach.reachesNoRow() {
		t.Fatalf("seated again the person reaches no row: %+v", reach)
	}
}

func TestAssumedGroupSeat_ANewRowOfAPersonWhoseSeatEndedTakesNoTags(t *testing.T) {
	w := newReachWalk(t)
	group := w.groupCarrying(t, "EMEA", "emea")
	as := w.callerIn(t, "emea-coordinator", "Coordinator", group)
	ctx := agencies.WithLoginSession(accounts.WithID(context.Background(), "emea-coordinator"), cookieSessionKeyOf(as.Value))

	if tags, err := w.deps.tagsOfNewRow(ctx, w.instance); err != nil || len(tags) == 0 {
		t.Fatalf("a seated person stamps %v %v, want the tags of the group", tags, err)
	}
	w.endSeatsIn(t, "emea-coordinator", group)
	if tags, err := w.deps.tagsOfNewRow(ctx, w.instance); err == nil || len(tags) != 0 {
		t.Fatalf("after the seat ended the person stamps %v %v, want the refusal to assume a group", tags, err)
	}
}

func TestAssumedGroupSeat_BacklogAccessEndsWithTheSeatAndReturnsWhenReseated(t *testing.T) {
	w := newGroupRoleWalk(t)
	id, kofi := w.resident(t, "Kofi", "Support")
	w.giveRole(t, "Support", "Reader")
	w.backlogWith(t, "see", "Support")
	w.journeyIssue(t, "backlog", "to-do")
	support := w.group(t, "Support")

	if got := w.visibleBacklogs(t, kofi); len(got) != 1 {
		t.Fatalf("seated in Support (Can see): backlogs %v, want the backlog", got)
	}
	w.endSeatsIn(t, id, support)
	if code := w.list(t, kofi); code != http.StatusForbidden {
		t.Fatalf("after the seat ended: list %d, want 403", code)
	}
	w.grantSeat(t, id, support, w.roles["Reader"])
	if got := w.visibleBacklogs(t, kofi); len(got) != 1 {
		t.Fatalf("seated again: backlogs %v, want the backlog", got)
	}
}
