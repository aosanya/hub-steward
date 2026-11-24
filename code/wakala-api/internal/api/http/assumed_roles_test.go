package http

import (
	"context"
	"net/http"
	"slices"
	"testing"
	"time"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/agencies"
)

func (w stepRunWalk) assumeDirectly(t *testing.T, as *http.Cookie, actorID, groupID string) {
	t.Helper()
	kept, ok := w.deps.Registry.(agencies.AssumedGroups)
	if !ok {
		t.Fatal("the registry does not keep assumed groups")
	}
	if err := kept.AssumeGroup(context.Background(), cookieSessionKeyPrefix+digest(as.Value), w.instance, actorID, groupID, time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("AssumeGroup: %v", err)
	}
}

func (w assumedGroupWalk) seatIn(t *testing.T, actorID, groupID, role string) {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	if _, err := um.EnsureActor(ctx, actorID); err != nil {
		t.Fatalf("EnsureActor: %v", err)
	}
	published, err := mgr.GetRole(ctx, w.roles[role])
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	kind, err := um.RoleKindForDefinitionRole(ctx, definitionRoleID(agencymodels.DocumentRole{ID: published.ID, Code: published.Code}))
	if err != nil {
		t.Fatalf("RoleKindForDefinitionRole: %v", err)
	}
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: actorID, GroupID: groupID, KindID: kind.ID}); err != nil {
		t.Fatalf("GrantRole: %v", err)
	}
}

func (w assumedGroupWalk) rolesHeldBy(t *testing.T, as *http.Cookie) []string {
	t.Helper()
	rec := w.call(t, "GET", w.path("my-roles"), nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("my-roles: %d %s, want 200", rec.Code, rec.Body.String())
	}
	names := roleCodesOf(t, decodeObject(t, rec))
	slices.Sort(names)
	return names
}

func (w assumedGroupWalk) assumeOK(t *testing.T, as *http.Cookie, groupID string) {
	t.Helper()
	if rec := w.assume(t, as, groupID); rec.Code != http.StatusOK {
		t.Fatalf("assume %s: %d %s, want 200", groupID, rec.Code, rec.Body.String())
	}
}

func wantRoles(t *testing.T, what string, got []string, want ...string) {
	t.Helper()
	if want == nil {
		want = []string{}
	}
	if !slices.Equal(got, want) {
		t.Fatalf("%s: roles %v, want %v", what, got, want)
	}
}

func TestRoleResolver_OnlyTheSeatsOfTheAssumedGroupAreHeld(t *testing.T) {
	w := newAssumedGroupWalk(t)
	session := w.cookieFor(t, w.person)

	w.assumeOK(t, session, w.staffGroup)
	wantRoles(t, "assuming Staff", w.rolesHeldBy(t, session), "Volunteer")

	w.assumeOK(t, session, w.fieldGroup)
	wantRoles(t, "assuming Field", w.rolesHeldBy(t, session), "Liaison")
}

func TestRoleResolver_NoAssumedGroupHoldsNoRolesAndNoPermissions(t *testing.T) {
	w := newAssumedGroupWalk(t)
	w.deps.rolePermissionsOverride = func(context.Context, string) ([]string, error) {
		return []string{"task.read"}, nil
	}
	session := w.cookieFor(t, w.person)

	rec := w.call(t, "GET", w.path("my-roles"), nil, session)
	body := decodeObject(t, rec)
	if roles, _ := body["roles"].([]any); len(roles) != 0 {
		t.Fatalf("a session with no assumed group holds %v, want no roles", roles)
	}
	if permissions, _ := body["permissions"].([]any); len(permissions) != 0 {
		t.Fatalf("a session with no assumed group holds %v, want no permissions", permissions)
	}
}

func TestRoleResolver_TwoSessionsOfOnePersonHoldTheirOwnRoles(t *testing.T) {
	w := newAssumedGroupWalk(t)
	phone, laptop := w.cookieFor(t, w.person), w.cookieFor(t, w.person)
	w.assumeOK(t, phone, w.staffGroup)
	w.assumeOK(t, laptop, w.fieldGroup)

	wantRoles(t, "the phone on Staff", w.rolesHeldBy(t, phone), "Volunteer")
	wantRoles(t, "the laptop on Field", w.rolesHeldBy(t, laptop), "Liaison")
}

func TestRoleResolver_TheLinkedRoleOfAMemberNoLongerCounts(t *testing.T) {
	w := newAssumedGroupWalk(t)
	links := w.deps.Registry.(agencies.AgencyRoleLinks)
	if err := links.SetAgencyRole(context.Background(), w.instance, w.person, w.roles["Coordinator"]); err != nil {
		t.Fatalf("SetAgencyRole: %v", err)
	}
	session := w.cookieFor(t, w.person)

	w.assumeOK(t, session, w.staffGroup)
	wantRoles(t, "a linked Coordinator role beside a Volunteer seat", w.rolesHeldBy(t, session), "Volunteer")
}

func TestRoleResolver_ARoleGivenToAGroupNoLongerCounts(t *testing.T) {
	w := newAssumedGroupWalk(t)
	um, err := w.deps.Registry.ActorManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	if _, err := um.AssignGroup(context.Background(), mwanachamaactor.ActorGroupAssignment{ActorID: w.person, GroupID: w.staffGroup}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
	given := w.deps.Registry.(agencies.GroupRoles)
	if err := given.GiveGroupRole(context.Background(), w.instance, w.staffGroup, w.roles["Coordinator"]); err != nil {
		t.Fatalf("GiveGroupRole: %v", err)
	}
	session := w.cookieFor(t, w.person)

	w.assumeOK(t, session, w.staffGroup)
	wantRoles(t, "a role given to Staff beside a Volunteer seat", w.rolesHeldBy(t, session), "Volunteer")
}

func TestRoleResolver_ThePlatformOwnerHoldsOnlyWhatTheAssumedGroupSeats(t *testing.T) {
	w := newAssumedGroupWalk(t)
	w.seatIn(t, ownerAccountID, w.staffGroup, "Coordinator")
	w.seatIn(t, ownerAccountID, w.fieldGroup, "Liaison")
	session := w.cookieFor(t, ownerAccountID)

	wantRoles(t, "the owner with no assumed group", w.rolesHeldBy(t, session))
	w.assumeOK(t, session, w.staffGroup)
	wantRoles(t, "the owner assuming Staff", w.rolesHeldBy(t, session), "Coordinator")
	body := decodeObject(t, w.call(t, "GET", w.path("my-roles"), nil, session))
	if permissions, _ := body["permissions"].([]any); len(permissions) != len(allPermissionCodes()) {
		t.Fatalf("the owner holds %d permission codes, want every one of %d", len(permissions), len(allPermissionCodes()))
	}
}

func TestRoleResolver_AnAgencyKeyWithNoAssumedGroupHoldsNothing(t *testing.T) {
	w := apiKeyWalk(t)
	minted := w.call(t, "POST", "/instances/"+w.instance+"/api-keys", map[string]any{"name": "intake bot"}, w.owner)
	if minted.Code != http.StatusCreated {
		t.Fatalf("mint a key: %d %s, want 201", minted.Code, minted.Body.String())
	}
	body := decodeObject(t, minted)
	token, _ := body["token"].(string)
	id, _ := body["id"].(string)
	links := w.deps.Registry.(agencies.AgencyRoleLinks)
	if err := links.SetAgencyRole(context.Background(), w.instance, "agency-key-"+id, w.roles["Volunteer"]); err != nil {
		t.Fatalf("SetAgencyRole: %v", err)
	}

	rec := w.bearerCall(t, "GET", "/instances/"+w.instance+"/my-roles", token)
	if rec.Code != http.StatusOK {
		t.Fatalf("my-roles as a key: %d %s, want 200", rec.Code, rec.Body.String())
	}
	wantRoles(t, "a key with a linked role and no assumed group", roleCodesOf(t, decodeObject(t, rec)))
}

func TestRoleResolver_AStepIsOpenOnlyToTheRoleOfTheAssumedGroup(t *testing.T) {
	w := newAssumedGroupWalk(t)
	session := w.cookieFor(t, w.person)

	if got := titles(w.available(t, session)); len(got) != 0 {
		t.Fatalf("a session with no assumed group is offered %v, want nothing", got)
	}
	w.assumeOK(t, session, w.fieldGroup)
	if got := titles(w.available(t, session)); len(got) != 0 {
		t.Fatalf("assuming Field is offered %v, want nothing, the first step is the Volunteer's", got)
	}
	w.assumeOK(t, session, w.staffGroup)
	if got := titles(w.available(t, session)); !slices.Equal(got, []string{"Report a referral"}) {
		t.Fatalf("assuming Staff is offered %v, want Report a referral", got)
	}
}

func TestRoleResolver_TheApprovalLimitIsTheLargestOfTheAssumedGroupSeatsOnly(t *testing.T) {
	w := approvalWalk(t)
	approver := w.approver(t, "Anele", intp(100), intp(5000))
	order := w.raiseClaim(t)
	if order == "" {
		t.Fatal("no run")
	}
	um, err := w.deps.Registry.ActorManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	seats, err := um.ListRoleAssignmentsForActor(context.Background(), approver.actorID, true)
	if err != nil || len(seats) != 2 {
		t.Fatalf("seats of the approver: %v %v", seats, err)
	}
	for _, seat := range seats {
		session := w.cookieFor(t, approver.actorID)
		w.assumeDirectly(t, session, approver.actorID, seat.GroupID)
		steps := w.limitedSteps(t, session)
		var limit *int
		for _, s := range steps {
			if s.Title == "Approve the amount" && s.ApprovalLimit != nil {
				limit = s.ApprovalLimit.Amount
			}
		}
		if limit == nil || *limit != *seat.ApprovalLimit {
			t.Fatalf("assuming the group of the %d seat shows a different limit, want %d", *seat.ApprovalLimit, *seat.ApprovalLimit)
		}
	}
}
