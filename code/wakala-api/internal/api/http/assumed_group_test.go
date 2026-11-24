package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/apikeys"
)

type assumedGroupWalk struct {
	stepRunWalk
	person     string
	staffGroup string
	fieldGroup string
}

func newAssumedGroupWalk(t *testing.T) assumedGroupWalk {
	t.Helper()
	w := newStepRunWalk(t, referralPlan(), "Volunteer", "Coordinator")
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	person := w.subjects["Volunteer"]
	seats, err := um.ListRoleAssignmentsForActor(ctx, person, true)
	if err != nil || len(seats) != 1 {
		t.Fatalf("seats of the volunteer: %v %v", seats, err)
	}
	field, err := um.CreateGroup(ctx, mwanachamaactor.Group{Name: "Field"})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	liaison, err := mgr.GetRole(ctx, w.roles["Liaison"])
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	kind, err := um.RoleKindForDefinitionRole(ctx, definitionRoleID(agencymodels.DocumentRole{ID: liaison.ID, Code: liaison.Code}))
	if err != nil {
		t.Fatalf("RoleKindForDefinitionRole: %v", err)
	}
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: person, GroupID: field.ID, KindID: kind.ID}); err != nil {
		t.Fatalf("GrantRole: %v", err)
	}
	return assumedGroupWalk{stepRunWalk: w, person: person, staffGroup: seats[0].GroupID, fieldGroup: field.ID}
}

func (w assumedGroupWalk) path(suffix string) string {
	return "/instances/" + w.instance + "/" + suffix
}

func (w assumedGroupWalk) assume(t *testing.T, as *http.Cookie, groupID string) *httptest.ResponseRecorder {
	t.Helper()
	return w.call(t, "PUT", w.path("my-group"), map[string]any{"group_id": groupID}, as)
}

func (w assumedGroupWalk) assumed(t *testing.T, as *http.Cookie) any {
	t.Helper()
	rec := w.call(t, "GET", w.path("my-group"), nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("read the assumed group: %d %s, want 200", rec.Code, rec.Body.String())
	}
	group, present := decodeObject(t, rec)["group"]
	if !present {
		t.Fatalf("read the assumed group: no group key in %s", rec.Body.String())
	}
	if group == nil {
		return nil
	}
	return group.(map[string]any)["id"]
}

func TestAssumedGroup_ListsTheGroupsWherePersonHoldsSeats(t *testing.T) {
	w := newAssumedGroupWalk(t)

	rec := w.call(t, "GET", w.path("my-groups"), nil, w.people["Volunteer"])
	if rec.Code != http.StatusOK {
		t.Fatalf("list my groups: %d %s, want 200", rec.Code, rec.Body.String())
	}
	out := decodeObject(t, rec)
	groups, _ := out["groups"].([]any)
	if len(groups) != 2 {
		t.Fatalf("groups of the volunteer: %s, want two", rec.Body.String())
	}
	byID := map[string]map[string]any{}
	for _, g := range groups {
		item := g.(map[string]any)
		byID[item["id"].(string)] = item
	}
	staff, field := byID[w.staffGroup], byID[w.fieldGroup]
	if staff == nil || staff["name"] != "Staff" || field == nil || field["name"] != "Field" {
		t.Fatalf("groups of the volunteer: %s, want Staff and Field by id and name", rec.Body.String())
	}
	if roles, _ := staff["roles"].([]any); len(roles) != 1 || roles[0] != "Volunteer" {
		t.Fatalf("roles in Staff: %v, want Volunteer", staff["roles"])
	}
	if roles, _ := field["roles"].([]any); len(roles) != 1 || roles[0] != "Liaison" {
		t.Fatalf("roles in Field: %v, want Liaison", field["roles"])
	}
	if out["assumed_group_id"] != "" {
		t.Fatalf("assumed_group_id before any choice: %v, want empty", out["assumed_group_id"])
	}

	rec = w.call(t, "GET", w.path("my-groups"), nil, w.people["Coordinator"])
	if groups, _ := decodeObject(t, rec)["groups"].([]any); rec.Code != http.StatusOK || len(groups) != 1 {
		t.Fatalf("groups of the coordinator: %d %s, want one", rec.Code, rec.Body.String())
	}
}

func TestAssumedGroup_TwoSessionsOfOnePersonAssumeDifferentGroupsAtOnce(t *testing.T) {
	w := newAssumedGroupWalk(t)
	phone, laptop := w.cookieFor(t, w.person), w.cookieFor(t, w.person)

	if rec := w.assume(t, phone, w.staffGroup); rec.Code != http.StatusOK {
		t.Fatalf("phone assumes Staff: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.assume(t, laptop, w.fieldGroup); rec.Code != http.StatusOK {
		t.Fatalf("laptop assumes Field: %d %s, want 200", rec.Code, rec.Body.String())
	}

	if got := w.assumed(t, phone); got != w.staffGroup {
		t.Fatalf("phone reads %v, want Staff %s", got, w.staffGroup)
	}
	if got := w.assumed(t, laptop); got != w.fieldGroup {
		t.Fatalf("laptop reads %v, want Field %s", got, w.fieldGroup)
	}
	rec := w.call(t, "GET", w.path("my-groups"), nil, laptop)
	if got := decodeObject(t, rec)["assumed_group_id"]; got != w.fieldGroup {
		t.Fatalf("laptop lists assumed_group_id %v, want Field", got)
	}
}

func TestAssumedGroup_ASessionWithNoChoiceReportsNone(t *testing.T) {
	w := newAssumedGroupWalk(t)
	phone, laptop := w.cookieFor(t, w.person), w.cookieFor(t, w.person)

	if got := w.assumed(t, phone); got != nil {
		t.Fatalf("a new session reads %v, want none", got)
	}
	if rec := w.assume(t, phone, w.staffGroup); rec.Code != http.StatusOK {
		t.Fatalf("phone assumes Staff: %d %s", rec.Code, rec.Body.String())
	}
	if got := w.assumed(t, laptop); got != nil {
		t.Fatalf("another session of the same person reads %v, want none", got)
	}
}

func TestAssumedGroup_ASecondChoiceInTheSameSessionReplacesTheFirst(t *testing.T) {
	w := newAssumedGroupWalk(t)
	phone := w.cookieFor(t, w.person)

	w.assume(t, phone, w.staffGroup)
	if rec := w.assume(t, phone, w.fieldGroup); rec.Code != http.StatusOK {
		t.Fatalf("switch to Field: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if got := w.assumed(t, phone); got != w.fieldGroup {
		t.Fatalf("after the switch the session reads %v, want Field", got)
	}
}

func TestAssumedGroup_AGroupWithoutASeatIsRefused(t *testing.T) {
	w := newAssumedGroupWalk(t)
	coordinator := w.people["Coordinator"]

	rec := w.assume(t, coordinator, w.fieldGroup)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("coordinator assumes Field with no seat: %d %s, want 403", rec.Code, rec.Body.String())
	}
	unknown := w.assume(t, coordinator, "00000000-0000-4000-8000-00000000dead")
	if unknown.Code != http.StatusForbidden || unknown.Body.String() != rec.Body.String() {
		t.Fatalf("coordinator assumes a group that does not exist: %d %s, want the same 403 as %s", unknown.Code, unknown.Body.String(), rec.Body.String())
	}
	if got := w.assumed(t, coordinator); got != nil {
		t.Fatalf("after the refusals the session reads %v, want none", got)
	}
	if rec := w.assume(t, w.owner, w.staffGroup); rec.Code != http.StatusForbidden {
		t.Fatalf("the owner assumes Staff with no seat: %d %s, want 403", rec.Code, rec.Body.String())
	}
}

func TestAssumedGroup_ABlankGroupIsRefused(t *testing.T) {
	w := newAssumedGroupWalk(t)
	if rec := w.assume(t, w.people["Volunteer"], "  "); rec.Code != http.StatusBadRequest {
		t.Fatalf("assume a blank group: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestAssumedGroup_NothingIsRememberedAfterSignOut(t *testing.T) {
	w := newAssumedGroupWalk(t)
	first := w.cookieFor(t, w.person)
	w.assume(t, first, w.staffGroup)

	if rec := w.call(t, "POST", "/auth/signout", nil, first); rec.Code != http.StatusNoContent {
		t.Fatalf("sign out: %d %s, want 204", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", w.path("my-group"), nil, first); rec.Code != http.StatusUnauthorized {
		t.Fatalf("the signed-out cookie reads the choice: %d %s, want 401", rec.Code, rec.Body.String())
	}
	if got := w.assumed(t, w.cookieFor(t, w.person)); got != nil {
		t.Fatalf("the next login reads %v, want none", got)
	}
}

func TestAssumedGroup_ASeatThatEndedMakesTheChoiceReadNone(t *testing.T) {
	w := newAssumedGroupWalk(t)
	phone := w.cookieFor(t, w.person)
	w.assume(t, phone, w.fieldGroup)

	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	seats, err := um.ListRoleAssignmentsForActor(ctx, w.person, true)
	if err != nil {
		t.Fatalf("ListRoleAssignmentsForActor: %v", err)
	}
	for _, seat := range seats {
		if seat.GroupID == w.fieldGroup {
			if err := um.RevokeRole(ctx, seat.ID); err != nil {
				t.Fatalf("RevokeRole: %v", err)
			}
		}
	}
	if got := w.assumed(t, phone); got != nil {
		t.Fatalf("after the seat ended the session reads %v, want none", got)
	}
}

func TestAssumedGroup_APersonOutsideTheAgencyIsTurnedAway(t *testing.T) {
	w := newAssumedGroupWalk(t)
	stranger := w.cookieFor(t, "a-stranger")
	for _, call := range []struct{ method, suffix string }{{"GET", "my-groups"}, {"GET", "my-group"}} {
		if rec := w.call(t, call.method, w.path(call.suffix), nil, stranger); rec.Code != http.StatusNotFound {
			t.Fatalf("%s %s as a stranger: %d %s, want 404", call.method, call.suffix, rec.Code, rec.Body.String())
		}
	}
	if rec := w.assume(t, stranger, w.staffGroup); rec.Code != http.StatusNotFound {
		t.Fatalf("a stranger assumes Staff: %d %s, want 404", rec.Code, rec.Body.String())
	}
}

func TestAssumedGroup_AnAPIKeyHasNoLoginSessionToAssumeIn(t *testing.T) {
	w := newAssumedGroupWalk(t)
	keys, err := apikeys.NewManager(stepRunDB(t))
	if err != nil {
		t.Fatalf("apikeys.NewManager: %v", err)
	}
	w.deps.APIKeys = keys
	w.handler = NewRouter(w.deps)

	minted := w.call(t, "POST", w.path("api-keys"), map[string]any{"name": "intake bot"}, w.owner)
	if minted.Code != http.StatusCreated {
		t.Fatalf("mint a key: %d %s, want 201", minted.Code, minted.Body.String())
	}
	token, _ := decodeObject(t, minted)["token"].(string)

	for _, call := range []struct {
		method, suffix string
		body           string
	}{{"PUT", "my-group", `{"group_id":"` + w.staffGroup + `"}`}, {"GET", "my-group", ""}} {
		req := httptest.NewRequest(call.method, w.path(call.suffix), strings.NewReader(call.body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		w.handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("%s %s with an API key: %d %s, want 403", call.method, call.suffix, rec.Code, rec.Body.String())
		}
	}
}

func TestAssumedGroup_BehindTheAccountRouter(t *testing.T) {
	w := newAssumedGroupWalk(t)
	noOwnDatabase := func(context.Context, string) (accounts.Connection, bool, error) {
		return accounts.Connection{}, false, nil
	}
	w.deps.Registry = accounts.NewRouter(w.deps.Registry, noOwnDatabase, nil, 4)
	phone := w.cookieFor(t, w.person)

	if rec := w.assume(t, phone, w.fieldGroup); rec.Code != http.StatusOK {
		t.Fatalf("assume Field through the router: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if got := w.assumed(t, phone); got != w.fieldGroup {
		t.Fatalf("read through the router: %v, want Field", got)
	}
}
