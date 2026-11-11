package http

import (
	"context"
	"net/http"
	"strings"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
)

func TestRoleSeat_DepartedResidentCannotDoKeepSeatAfterLeaving(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	id, _ := seatFreshResident(t, w, "Resident Teal")
	if n := activeSeats(t, w, id); n != 1 {
		t.Fatalf("seated resident before leaving: %d active seats, want 1", n)
	}
	if rec := w.call(t, "POST", "/instances/"+w.instance+"/leave", map[string]any{}, w.cookieFor(t, id)); rec.Code != http.StatusNoContent {
		t.Fatalf("resident leaving: %d %s, want 204", rec.Code, rec.Body.String())
	}
	if n := activeSeats(t, w, id); n != 0 {
		t.Fatalf("resident after leaving: %d active seats, want 0", n)
	}
}

func TestGroupRoster_DepartedResidentCannotDoStayOnGroupRoster(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	ctx := context.Background()
	id, groupID := seatFreshResident(t, w, "Resident Sable")
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: id, GroupID: groupID}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
	if rec := w.call(t, "POST", "/instances/"+w.instance+"/leave", map[string]any{}, w.cookieFor(t, id)); rec.Code != http.StatusNoContent {
		t.Fatalf("resident leaving: %d %s, want 204", rec.Code, rec.Body.String())
	}
	held, err := um.ListGroupsForActor(ctx, id)
	if err != nil {
		t.Fatalf("ListGroupsForActor: %v", err)
	}
	if len(held) != 0 {
		t.Fatalf("resident after leaving: on %d group rosters, want 0", len(held))
	}
}

func TestGroupJoin_DepartedResidentCannotBeSeatedFromAPendingRequest(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	id, groupID := seatFreshResident(t, w, "Resident Slate")
	path := "/instances/" + w.instance
	ask := w.call(t, "POST", path+"/actor/groups/"+groupID+"/join", map[string]any{}, w.cookieFor(t, id))
	if ask.Code >= 300 {
		t.Fatalf("resident asking to join the group: %d %s", ask.Code, ask.Body.String())
	}
	request, _ := decodeObject(t, ask)["request"].(map[string]any)
	requestID, _ := request["id"].(string)
	if requestID == "" {
		t.Fatalf("asking to join returned no request id: %s", ask.Body.String())
	}
	if rec := w.call(t, "POST", path+"/leave", map[string]any{}, w.cookieFor(t, id)); rec.Code != http.StatusNoContent {
		t.Fatalf("resident leaving: %d %s, want 204", rec.Code, rec.Body.String())
	}
	rec := w.call(t, "POST", path+"/actor/join-requests/"+requestID+"/operator-approve", map[string]any{}, w.owner)
	if rec.Code < 400 {
		t.Errorf("owner approving a departed resident's pending request: %d %s, want refused", rec.Code, rec.Body.String())
	}
	roster := w.call(t, "GET", path+"/actor/groups/"+groupID+"/assignments", nil, w.owner)
	if strings.Contains(roster.Body.String(), id) {
		t.Errorf("departed resident %s seated in group roster: %s", id, roster.Body.String())
	}
}
