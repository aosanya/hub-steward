package http

import (
	"context"
	"net/http"
	"sort"
	"testing"
	"time"

	"wakalaserver/internal/agencies"
)

func (w assumedGroupWalk) disable(t *testing.T, groupID string, as *http.Cookie) int {
	t.Helper()
	return w.call(t, "POST", w.path("groups/"+groupID+"/disable"), nil, as).Code
}

func (w assumedGroupWalk) enable(t *testing.T, groupID string, as *http.Cookie) int {
	t.Helper()
	return w.call(t, "POST", w.path("groups/"+groupID+"/enable"), nil, as).Code
}

func (w assumedGroupWalk) listedGroupIDs(t *testing.T, as *http.Cookie) []string {
	t.Helper()
	rec := w.call(t, "GET", w.path("my-groups"), nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("list my groups: %d %s", rec.Code, rec.Body.String())
	}
	groups, _ := decodeObject(t, rec)["groups"].([]any)
	ids := []string{}
	for _, g := range groups {
		ids = append(ids, g.(map[string]any)["id"].(string))
	}
	sort.Strings(ids)
	return ids
}

func (w assumedGroupWalk) disabledGroupIDs(t *testing.T) []string {
	t.Helper()
	rec := w.call(t, "GET", w.path("disabled-groups"), nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("list disabled groups: %d %s, want 200", rec.Code, rec.Body.String())
	}
	raw, _ := decodeObject(t, rec)["group_ids"].([]any)
	ids := []string{}
	for _, id := range raw {
		ids = append(ids, id.(string))
	}
	return ids
}

func TestDisabledGroup_IsMissingFromMyGroupsUntilEnabled(t *testing.T) {
	w := newAssumedGroupWalk(t)
	volunteer := w.people["Volunteer"]
	both := []string{w.staffGroup, w.fieldGroup}
	sort.Strings(both)

	if code := w.disable(t, w.fieldGroup, w.owner); code != http.StatusOK {
		t.Fatalf("the owner disables Field: %d, want 200", code)
	}
	if got := w.listedGroupIDs(t, volunteer); len(got) != 1 || got[0] != w.staffGroup {
		t.Fatalf("groups listed while Field is disabled: %v, want only Staff", got)
	}
	if got := w.disabledGroupIDs(t); len(got) != 1 || got[0] != w.fieldGroup {
		t.Fatalf("disabled groups: %v, want Field", got)
	}

	if code := w.enable(t, w.fieldGroup, w.owner); code != http.StatusOK {
		t.Fatalf("the owner enables Field: %d, want 200", code)
	}
	if got := w.listedGroupIDs(t, volunteer); len(got) != 2 || got[0] != both[0] || got[1] != both[1] {
		t.Fatalf("groups listed after enabling: %v, want both", got)
	}
	if got := w.disabledGroupIDs(t); len(got) != 0 {
		t.Fatalf("disabled groups after enabling: %v, want none", got)
	}
}

func TestDisabledGroup_CannotBeAssumedAndReadsLikeAGroupWithNoSeat(t *testing.T) {
	w := newAssumedGroupWalk(t)
	volunteer := w.people["Volunteer"]
	w.disable(t, w.fieldGroup, w.owner)

	refused := w.assume(t, volunteer, w.fieldGroup)
	if refused.Code != http.StatusForbidden {
		t.Fatalf("assume a disabled group: %d %s, want 403", refused.Code, refused.Body.String())
	}
	unknown := w.assume(t, volunteer, "00000000-0000-4000-8000-00000000dead")
	if unknown.Body.String() != refused.Body.String() {
		t.Fatalf("a disabled group answers %s, want the answer of a missing group %s", refused.Body.String(), unknown.Body.String())
	}
	if got := w.assumed(t, volunteer); got != nil {
		t.Fatalf("after the refusal the session reads %v, want none", got)
	}

	w.enable(t, w.fieldGroup, w.owner)
	if rec := w.assume(t, volunteer, w.fieldGroup); rec.Code != http.StatusOK {
		t.Fatalf("assume Field once enabled: %d %s, want 200", rec.Code, rec.Body.String())
	}
}

func TestDisabledGroup_CutsASessionThatHadAssumedItAndEnablingRestoresIt(t *testing.T) {
	w := newAssumedGroupWalk(t)
	phone, laptop := w.cookieFor(t, w.person), w.cookieFor(t, w.person)
	w.assume(t, phone, w.fieldGroup)
	w.assume(t, laptop, w.staffGroup)

	w.disable(t, w.fieldGroup, w.owner)
	if got := w.assumed(t, phone); got != nil {
		t.Fatalf("the session that had assumed Field reads %v, want none", got)
	}
	rec := w.call(t, "GET", w.path("my-groups"), nil, phone)
	if got := decodeObject(t, rec)["assumed_group_id"]; got != "" {
		t.Fatalf("assumed_group_id of the cut session: %v, want empty", got)
	}
	if got := w.assumed(t, laptop); got != w.staffGroup {
		t.Fatalf("a session in another group reads %v, want Staff untouched", got)
	}

	if rec := w.assume(t, phone, w.staffGroup); rec.Code != http.StatusOK {
		t.Fatalf("the cut session picks Staff: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if got := w.assumed(t, phone); got != w.staffGroup {
		t.Fatalf("after picking another group the session reads %v, want Staff", got)
	}
	w.assume(t, phone, w.fieldGroup)
	w.enable(t, w.fieldGroup, w.owner)
	w.disable(t, w.fieldGroup, w.owner)
	w.enable(t, w.fieldGroup, w.owner)
	if got := w.assumed(t, phone); got != w.fieldGroup {
		t.Fatalf("after enabling the session reads %v, want Field back", got)
	}
}

func TestDisabledGroup_TheResolverReadSeesNoGroup(t *testing.T) {
	w := newAssumedGroupWalk(t)
	store, ok := w.deps.Registry.(agencies.AssumedGroups)
	if !ok {
		t.Fatalf("the registry does not keep assumed groups")
	}
	ctx := context.Background()
	if err := store.AssumeGroup(ctx, "cookie:resolver", w.instance, w.person, w.fieldGroup, farFuture()); err != nil {
		t.Fatalf("AssumeGroup: %v", err)
	}
	w.disable(t, w.fieldGroup, w.owner)
	if got, err := store.AssumedGroupOf(ctx, "cookie:resolver", w.instance, w.person); err != nil || got != "" {
		t.Fatalf("AssumedGroupOf of a disabled group: %q %v, want none", got, err)
	}
	w.enable(t, w.fieldGroup, w.owner)
	if got, err := store.AssumedGroupOf(ctx, "cookie:resolver", w.instance, w.person); err != nil || got != w.fieldGroup {
		t.Fatalf("AssumedGroupOf after enabling: %q %v, want Field", got, err)
	}
}

func TestDisabledGroup_CutsAKeySessionToo(t *testing.T) {
	w := newAssumedGroupWalk(t).withKeys(t)
	token := w.personalKey(t, w.people["Volunteer"])
	w.bearer(t, "PUT", "my-group", token, map[string]any{"group_id": w.fieldGroup})

	w.disable(t, w.fieldGroup, w.owner)
	if got := w.keyAssumed(t, token); got != nil {
		t.Fatalf("the key that had assumed Field reads %v, want none", got)
	}
	rec := w.bearer(t, "GET", "my-groups", token, nil)
	if groups, _ := decodeObject(t, rec)["groups"].([]any); len(groups) != 1 {
		t.Fatalf("groups listed to the key: %s, want only Staff", rec.Body.String())
	}
	if rec := w.bearer(t, "PUT", "my-group", token, map[string]any{"group_id": w.fieldGroup}); rec.Code != http.StatusForbidden {
		t.Fatalf("the key assumes a disabled group: %d %s, want 403", rec.Code, rec.Body.String())
	}

	w.enable(t, w.fieldGroup, w.owner)
	if got := w.keyAssumed(t, token); got != w.fieldGroup {
		t.Fatalf("after enabling the key reads %v, want Field back", got)
	}
}

func TestDisabledGroup_KeepsItsSeatsAndTags(t *testing.T) {
	w := newAssumedGroupWalk(t)
	rec := w.call(t, "POST", w.path("tags"), map[string]any{"name": "north"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create a tag: %d %s", rec.Code, rec.Body.String())
	}
	tagID := decodeObject(t, rec)["id"].(string)
	if rec := w.call(t, "POST", w.path("group-tags"), map[string]any{"group_id": w.fieldGroup, "tag_id": tagID}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("give the tag: %d %s", rec.Code, rec.Body.String())
	}
	tagsOf := func() int {
		rec := w.call(t, "GET", w.path("tags?group_id="+w.fieldGroup), nil, w.owner)
		items, _ := decodeObject(t, rec)["items"].([]any)
		return len(items)
	}
	seatsOf := func() int {
		um, err := w.deps.Registry.ActorManager(context.Background(), w.instance)
		if err != nil {
			t.Fatalf("ActorManager: %v", err)
		}
		seats, err := um.ListRoleAssignmentsForActor(context.Background(), w.person, true)
		if err != nil {
			t.Fatalf("ListRoleAssignmentsForActor: %v", err)
		}
		return len(seats)
	}

	if code := w.disable(t, w.fieldGroup, w.owner); code != http.StatusOK {
		t.Fatalf("disable Field: %d, want 200", code)
	}
	if got := tagsOf(); got != 1 {
		t.Fatalf("tags of a disabled group: %d, want 1", got)
	}
	if got := seatsOf(); got != 2 {
		t.Fatalf("seats of the volunteer while Field is disabled: %d, want 2", got)
	}
	w.enable(t, w.fieldGroup, w.owner)
	if got := tagsOf(); got != 1 {
		t.Fatalf("tags after enabling: %d, want 1", got)
	}
	if got := seatsOf(); got != 2 {
		t.Fatalf("seats after enabling: %d, want 2", got)
	}
	rec = w.call(t, "GET", w.path("my-groups"), nil, w.people["Volunteer"])
	if groups, _ := decodeObject(t, rec)["groups"].([]any); len(groups) != 2 {
		t.Fatalf("groups after enabling: %s, want both with their roles", rec.Body.String())
	}
}

func TestDisabledGroup_OnlyTheGuardOfGroupAdministrationMayToggle(t *testing.T) {
	w := newAssumedGroupWalk(t).withKeys(t)
	resident := w.people["Volunteer"]
	if code := w.disable(t, w.fieldGroup, resident); code != http.StatusNotFound {
		t.Fatalf("a resident disables Field: %d, want 404 as on the tag routes", code)
	}
	if code := w.enable(t, w.fieldGroup, resident); code != http.StatusNotFound {
		t.Fatalf("a resident enables Field: %d, want 404", code)
	}
	if rec := w.call(t, "GET", w.path("disabled-groups"), nil, resident); rec.Code != http.StatusNotFound {
		t.Fatalf("a resident lists disabled groups: %d, want 404", rec.Code)
	}
	token, _ := w.agencyKey(t)
	if rec := w.bearer(t, "POST", "groups/"+w.fieldGroup+"/disable", token, nil); rec.Code != http.StatusForbidden {
		t.Fatalf("an agent disables Field: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if got := w.listedGroupIDs(t, resident); len(got) != 2 {
		t.Fatalf("groups listed after the refused calls: %v, want both", got)
	}
}

func TestDisabledGroup_AnUnknownGroupIsRefusedAndTogglingTwiceChangesNothing(t *testing.T) {
	w := newAssumedGroupWalk(t)
	if code := w.disable(t, "00000000-0000-4000-8000-00000000dead", w.owner); code != http.StatusUnprocessableEntity {
		t.Fatalf("disable an unknown group: %d, want 422", code)
	}
	if code := w.enable(t, "00000000-0000-4000-8000-00000000dead", w.owner); code != http.StatusUnprocessableEntity {
		t.Fatalf("enable an unknown group: %d, want 422", code)
	}
	for i := 0; i < 2; i++ {
		if code := w.disable(t, w.fieldGroup, w.owner); code != http.StatusOK {
			t.Fatalf("disable %d: %d, want 200", i, code)
		}
	}
	if got := w.disabledGroupIDs(t); len(got) != 1 {
		t.Fatalf("disabled groups after disabling twice: %v, want one", got)
	}
	for i := 0; i < 2; i++ {
		if code := w.enable(t, w.fieldGroup, w.owner); code != http.StatusOK {
			t.Fatalf("enable %d: %d, want 200", i, code)
		}
	}
	if got := w.disabledGroupIDs(t); len(got) != 0 {
		t.Fatalf("disabled groups after enabling twice: %v, want none", got)
	}
}

func farFuture() time.Time { return time.Now().Add(24 * time.Hour) }
