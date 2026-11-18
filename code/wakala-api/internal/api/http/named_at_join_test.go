package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
)

func (w declarationWalk) seatPerson(t *testing.T, key string, person mwanachamaactor.Actor, role string) string {
	t.Helper()
	ctx := context.Background()
	directory, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := directory.CreateActor(ctx, person)
	if err != nil {
		t.Fatalf("CreateActor %s: %v", key, err)
	}
	path := "/instances/" + w.instance
	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": actor.ID}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds %s: %d %s", key, rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", path+"/members/"+actor.ID+"/agency-role", map[string]any{"agency_role_id": w.roles[role]}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner seats %s: %d %s", key, rec.Code, rec.Body.String())
	}
	w.members[key] = actor.ID
	w.people[key] = w.cookieFor(t, actor.ID)
	return actor.ID
}

func nameOfActor(items []map[string]any, actorID string) (string, bool) {
	for _, item := range items {
		if item["actor_id"] == actorID {
			return item["name"].(string), true
		}
	}
	return "", false
}

func TestTheRegisterShowsAMemberWithNoNameAsAnUnnamedPersonNeverAsTheAccountId(t *testing.T) {
	w := newDeclarationWalk(t)
	unnamed := w.seatPerson(t, "Unnamed declarer", mwanachamaactor.Actor{}, "Council member")
	silent := w.seatPerson(t, "Unnamed silent", mwanachamaactor.Actor{}, "Council member")
	w.declare(t, "Unnamed declarer", "none")

	register := w.register(t, w.officer)
	if got, found := nameOfActor(objectsIn(t, register, "declared"), unnamed); !found || got != "Unnamed person" {
		t.Fatalf("declared member with no name reads %q (found %v), want \"Unnamed person\" and never the account id", got, found)
	}
	if got, found := nameOfActor(objectsIn(t, register, "not_declared"), silent); !found || got != "Unnamed person" {
		t.Fatalf("member who has not declared and has no name reads %q (found %v), want \"Unnamed person\"", got, found)
	}
}

func TestTheRegisterNamesAMemberFromTheirFirstAndLastNameWhenNoDisplayNameIsSet(t *testing.T) {
	w := newDeclarationWalk(t)
	id := w.seatPerson(t, "Edit declarer", mwanachamaactor.Actor{FirstName: "Edit", LastName: "Szentgyorgyi"}, "Council member")
	w.declare(t, "Edit declarer", "none")

	got, found := nameOfActor(objectsIn(t, w.register(t, w.officer), "declared"), id)
	if !found || got != "Edit Szentgyorgyi" {
		t.Fatalf("member with a first and last name only reads %q (found %v), want \"Edit Szentgyorgyi\"", got, found)
	}
}

func invitedActor(t *testing.T, d clerkDesk, email string) mwanachamaactor.Actor {
	t.Helper()
	directory, err := d.w.deps.Registry.ActorManager(context.Background(), d.w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := directory.GetActor(context.Background(), "invited-"+email)
	if err != nil {
		t.Fatalf("GetActor invited-%s: %v", email, err)
	}
	return actor
}

func TestAMemberInvitedInAListIsNamedFromTheirRowWhenTheyJoin(t *testing.T) {
	d := newClerkDesk(t)

	rec := d.w.call(t, "POST", d.path+"/invitations/batch", d.invitationRows("ben@example.test"), d.w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner sends a list: %d %s", rec.Code, rec.Body.String())
	}
	actor := invitedActor(t, d, "ben@example.test")
	if actor.FirstName != "Ben" || actor.LastName != "Kiss" || actor.DisplayName != "Ben Kiss" {
		t.Fatalf("invited member is first %q last %q display %q, want Ben, Kiss and Ben Kiss", actor.FirstName, actor.LastName, actor.DisplayName)
	}
}

func TestTwoMembersInvitedWithTheSameNameAreBothNamedAndTheSecondKeepsNoDisplayName(t *testing.T) {
	d := newClerkDesk(t)
	rows := map[string]any{"rows": []map[string]any{
		{"first_name": "Ben", "last_name": "Kiss", "email": "ben-one@example.test", "group_code": d.groupKey},
		{"first_name": "Ben", "last_name": "Kiss", "email": "ben-two@example.test", "group_code": d.groupKey},
	}}

	rec := d.w.call(t, "POST", d.path+"/invitations/batch", rows, d.w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner sends a list with two people of the same name: %d %s", rec.Code, rec.Body.String())
	}
	one, two := invitedActor(t, d, "ben-one@example.test"), invitedActor(t, d, "ben-two@example.test")
	if one.FirstName != "Ben" || two.FirstName != "Ben" || one.LastName != "Kiss" || two.LastName != "Kiss" {
		t.Fatalf("both are named Ben Kiss: got %q %q and %q %q", one.FirstName, one.LastName, two.FirstName, two.LastName)
	}
	if one.DisplayName != "Ben Kiss" || two.DisplayName != "" {
		t.Fatalf("display names are %q and %q, want the first to hold Ben Kiss and the second to hold none", one.DisplayName, two.DisplayName)
	}
}

func TestAnInvitedMemberWhoAlreadyHasANameKeepsIt(t *testing.T) {
	d := newClerkDesk(t)
	directory, err := d.w.deps.Registry.ActorManager(context.Background(), d.w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	if _, err := directory.EnsureActor(context.Background(), "invited-ben@example.test"); err != nil {
		t.Fatalf("EnsureActor: %v", err)
	}
	if _, err := directory.SetActorName(context.Background(), "invited-ben@example.test", "Benedek", "Kiss-Real"); err != nil {
		t.Fatalf("SetActorName: %v", err)
	}

	rec := d.w.call(t, "POST", d.path+"/invitations/batch", d.invitationRows("ben@example.test"), d.w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner sends a list: %d %s", rec.Code, rec.Body.String())
	}
	actor := invitedActor(t, d, "ben@example.test")
	if actor.FirstName != "Benedek" || actor.LastName != "Kiss-Real" {
		t.Fatalf("a name the member already set was replaced by the list's: first %q last %q", actor.FirstName, actor.LastName)
	}
}
