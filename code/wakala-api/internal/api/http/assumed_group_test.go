package http

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/apikeys"
	"wakalaserver/internal/shopauth"
)

type assumedGroupWalk struct {
	stepRunWalk
	person     string
	staffGroup string
	fieldGroup string
	seatKind   string
}

func newAssumedGroupWalk(t *testing.T) assumedGroupWalk {
	t.Helper()
	w := newStepRunWalk(t, referralPlan(), "Volunteer", "Coordinator")
	if err := w.db.Exec("DELETE FROM agency_assumed_groups").Error; err != nil {
		t.Fatalf("clear the choices the harness made: %v", err)
	}
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
	return assumedGroupWalk{stepRunWalk: w, person: person, staffGroup: seats[0].GroupID, fieldGroup: field.ID, seatKind: kind.ID}
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

func projectLoginToken(sessionID, nonce string) string {
	claims, _ := json.Marshal(map[string]string{"session_id": sessionID, "nonce": nonce})
	return "header." + base64.RawURLEncoding.EncodeToString(claims) + ".signature"
}

func TestAssumedGroup_ProjectLoginsAreSeparateSessionsAndARefreshKeepsTheChoice(t *testing.T) {
	w := newAssumedGroupWalk(t)
	gotrue := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, _ *http.Request) {
		fmt.Fprintf(rw, `{"id":%q}`, w.person)
	}))
	t.Cleanup(gotrue.Close)
	w.deps.CatalogAuth = shopauth.Verifier{URL: gotrue.URL, AnonKey: "anon"}
	w.handler = NewRouter(w.deps)

	send := func(method, token string, body string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, w.path("my-group"), strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		w.handler.ServeHTTP(rec, req)
		return rec
	}
	groupOf := func(token string) any {
		rec := send("GET", token, "")
		if rec.Code != http.StatusOK {
			t.Fatalf("read with a project token: %d %s, want 200", rec.Code, rec.Body.String())
		}
		if group, _ := decodeObject(t, rec)["group"].(map[string]any); group != nil {
			return group["id"]
		}
		return nil
	}
	phone, laptop := projectLoginToken("session-phone", "1"), projectLoginToken("session-laptop", "1")

	if rec := send("PUT", phone, `{"group_id":"`+w.staffGroup+`"}`); rec.Code != http.StatusOK {
		t.Fatalf("phone assumes Staff: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := send("PUT", laptop, `{"group_id":"`+w.fieldGroup+`"}`); rec.Code != http.StatusOK {
		t.Fatalf("laptop assumes Field: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if groupOf(phone) != w.staffGroup || groupOf(laptop) != w.fieldGroup {
		t.Fatalf("the two project logins read %v and %v, want Staff and Field", groupOf(phone), groupOf(laptop))
	}
	if got := groupOf(projectLoginToken("session-phone", "refreshed")); got != w.staffGroup {
		t.Fatalf("the phone after a token refresh reads %v, want Staff", got)
	}
	if got := groupOf(projectLoginToken("session-new", "1")); got != nil {
		t.Fatalf("a new project login reads %v, want none", got)
	}
}

func TestAssumedGroup_AChoicePastItsEndReadsNone(t *testing.T) {
	w := newAssumedGroupWalk(t)
	store, ok := w.deps.Registry.(agencies.AssumedGroups)
	if !ok {
		t.Fatalf("the registry does not keep assumed groups")
	}
	ctx := context.Background()
	if err := store.AssumeGroup(ctx, "cookie:ended", w.instance, w.person, w.staffGroup, time.Now().Add(-time.Minute)); err != nil {
		t.Fatalf("AssumeGroup: %v", err)
	}
	if err := store.AssumeGroup(ctx, "cookie:live", w.instance, w.person, w.staffGroup, time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("AssumeGroup: %v", err)
	}
	if got, err := store.AssumedGroupOf(ctx, "cookie:ended", w.instance, w.person); err != nil || got != "" {
		t.Fatalf("an ended choice reads %q %v, want none", got, err)
	}
	if got, err := store.AssumedGroupOf(ctx, "cookie:live", w.instance, w.person); err != nil || got != w.staffGroup {
		t.Fatalf("a live choice reads %q %v, want Staff", got, err)
	}
	if got, err := store.AssumedGroupOf(ctx, "cookie:live", w.instance, "someone-else"); err != nil || got != "" {
		t.Fatalf("another person on the same session key reads %q %v, want none", got, err)
	}
}

func (w assumedGroupWalk) withKeys(t *testing.T) assumedGroupWalk {
	t.Helper()
	keys, err := apikeys.NewManager(stepRunDB(t))
	if err != nil {
		t.Fatalf("apikeys.NewManager: %v", err)
	}
	w.deps.APIKeys = keys
	w.handler = NewRouter(w.deps)
	return w
}

func (w assumedGroupWalk) bearer(t *testing.T, method, suffix, token string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var payload []byte
	if body != nil {
		payload, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, w.path(suffix), strings.NewReader(string(payload)))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, req)
	return rec
}

func (w assumedGroupWalk) personalKey(t *testing.T, as *http.Cookie) string {
	t.Helper()
	rec := w.call(t, "POST", "/auth/api-keys", map[string]any{"name": "personal bot"}, as)
	if rec.Code != http.StatusCreated {
		t.Fatalf("mint a personal key: %d %s, want 201", rec.Code, rec.Body.String())
	}
	return decodeObject(t, rec)["token"].(string)
}

func (w assumedGroupWalk) agencyKey(t *testing.T) (token, member string) {
	t.Helper()
	rec := w.call(t, "POST", w.path("api-keys"), map[string]any{"name": "intake bot"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("mint an agency key: %d %s, want 201", rec.Code, rec.Body.String())
	}
	made := decodeObject(t, rec)
	return made["token"].(string), apikeys.AgencyKeyCaller(made["id"].(string))
}

func (w assumedGroupWalk) seat(t *testing.T, member, groupID string) {
	t.Helper()
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := um.EnsureActor(ctx, member)
	if err != nil {
		t.Fatalf("EnsureActor: %v", err)
	}
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: actor.ID, GroupID: groupID, KindID: w.seatKind}); err != nil {
		t.Fatalf("GrantRole: %v", err)
	}
}

func (w assumedGroupWalk) keyAssumed(t *testing.T, token string) any {
	t.Helper()
	rec := w.bearer(t, "GET", "my-group", token, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("a key reads its assumed group: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if group, _ := decodeObject(t, rec)["group"].(map[string]any); group != nil {
		return group["id"]
	}
	return nil
}

func TestAssumedGroup_AKeyStartsWithNoGroupAndListsTheGroupsOfItsMember(t *testing.T) {
	w := newAssumedGroupWalk(t).withKeys(t)
	token := w.personalKey(t, w.people["Volunteer"])

	if got := w.keyAssumed(t, token); got != nil {
		t.Fatalf("a new key reads %v, want none", got)
	}
	rec := w.bearer(t, "GET", "my-groups", token, nil)
	groups, _ := decodeObject(t, rec)["groups"].([]any)
	if rec.Code != http.StatusOK || len(groups) != 2 {
		t.Fatalf("groups listed to a key: %d %s, want the two groups of its member", rec.Code, rec.Body.String())
	}
	if got := decodeObject(t, rec)["assumed_group_id"]; got != "" {
		t.Fatalf("assumed_group_id of a new key: %v, want empty", got)
	}
}

func TestAssumedGroup_AKeyAssumesAGroupItsMemberHoldsASeatIn(t *testing.T) {
	w := newAssumedGroupWalk(t).withKeys(t)
	token := w.personalKey(t, w.people["Volunteer"])

	if rec := w.bearer(t, "PUT", "my-group", token, map[string]any{"group_id": w.fieldGroup}); rec.Code != http.StatusOK {
		t.Fatalf("a key assumes Field: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if got := w.keyAssumed(t, token); got != w.fieldGroup {
		t.Fatalf("the key reads %v, want Field %s", got, w.fieldGroup)
	}
	rec := w.bearer(t, "GET", "my-groups", token, nil)
	if got := decodeObject(t, rec)["assumed_group_id"]; got != w.fieldGroup {
		t.Fatalf("assumed_group_id of the key: %v, want Field", got)
	}
}

func TestAssumedGroup_AKeyCannotAssumeAGroupItsMemberHoldsNoSeatIn(t *testing.T) {
	w := newAssumedGroupWalk(t).withKeys(t)
	token := w.personalKey(t, w.people["Coordinator"])

	refused := w.bearer(t, "PUT", "my-group", token, map[string]any{"group_id": w.fieldGroup})
	if refused.Code != http.StatusForbidden {
		t.Fatalf("a key assumes Field with no seat: %d %s, want 403", refused.Code, refused.Body.String())
	}
	unknown := w.bearer(t, "PUT", "my-group", token, map[string]any{"group_id": "00000000-0000-4000-8000-00000000dead"})
	if unknown.Code != http.StatusForbidden || unknown.Body.String() != refused.Body.String() {
		t.Fatalf("a key assumes a group that does not exist: %d %s, want the same 403 as %s", unknown.Code, unknown.Body.String(), refused.Body.String())
	}
	if got := w.keyAssumed(t, token); got != nil {
		t.Fatalf("after the refusals the key reads %v, want none", got)
	}
	if rec := w.bearer(t, "PUT", "my-group", token, map[string]any{"group_id": "  "}); rec.Code != http.StatusBadRequest {
		t.Fatalf("a key assumes a blank group: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestAssumedGroup_TwoKeysOfOneMemberAndTheirLoginChooseSeparately(t *testing.T) {
	w := newAssumedGroupWalk(t).withKeys(t)
	first, second := w.personalKey(t, w.people["Volunteer"]), w.personalKey(t, w.people["Volunteer"])
	login := w.cookieFor(t, w.person)

	w.bearer(t, "PUT", "my-group", first, map[string]any{"group_id": w.staffGroup})
	w.bearer(t, "PUT", "my-group", second, map[string]any{"group_id": w.fieldGroup})

	if got := w.keyAssumed(t, first); got != w.staffGroup {
		t.Fatalf("first key reads %v, want Staff", got)
	}
	if got := w.keyAssumed(t, second); got != w.fieldGroup {
		t.Fatalf("second key reads %v, want Field", got)
	}
	if got := w.assumed(t, login); got != nil {
		t.Fatalf("a login of the same member reads %v, want none", got)
	}
	w.assume(t, login, w.staffGroup)
	w.bearer(t, "PUT", "my-group", second, map[string]any{"group_id": w.staffGroup})
	if got := w.keyAssumed(t, second); got != w.staffGroup {
		t.Fatalf("second key after switching reads %v, want Staff", got)
	}
}

func TestAssumedGroup_AnAgencyKeyAssumesAmongTheSeatsOfItsOwnMember(t *testing.T) {
	w := newAssumedGroupWalk(t).withKeys(t)
	token, member := w.agencyKey(t)
	w.seat(t, member, w.fieldGroup)

	if got := w.keyAssumed(t, token); got != nil {
		t.Fatalf("a new agency key reads %v, want none", got)
	}
	if rec := w.bearer(t, "PUT", "my-group", token, map[string]any{"group_id": w.staffGroup}); rec.Code != http.StatusForbidden {
		t.Fatalf("the agency key assumes Staff with no seat: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.bearer(t, "PUT", "my-group", token, map[string]any{"group_id": w.fieldGroup}); rec.Code != http.StatusOK {
		t.Fatalf("the agency key assumes Field: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if got := w.keyAssumed(t, token); got != w.fieldGroup {
		t.Fatalf("the agency key reads %v, want Field", got)
	}
	other, _ := w.agencyKey(t)
	if got := w.keyAssumed(t, other); got != nil {
		t.Fatalf("another agency key reads %v, want none", got)
	}
}

func TestAssumedGroup_ARevokedKeyIsTurnedAway(t *testing.T) {
	w := newAssumedGroupWalk(t).withKeys(t)
	volunteer := w.people["Volunteer"]
	rec := w.call(t, "POST", "/auth/api-keys", map[string]any{"name": "short lived"}, volunteer)
	made := decodeObject(t, rec)
	token := made["token"].(string)
	w.bearer(t, "PUT", "my-group", token, map[string]any{"group_id": w.staffGroup})

	if rec := w.call(t, "DELETE", "/auth/api-keys/"+made["id"].(string), nil, volunteer); rec.Code >= 300 {
		t.Fatalf("revoke the key: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.bearer(t, "GET", "my-group", token, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("a revoked key reads the choice: %d %s, want 401", rec.Code, rec.Body.String())
	}
}
