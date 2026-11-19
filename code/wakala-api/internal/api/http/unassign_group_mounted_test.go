package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
)

func rosterIncludes(t *testing.T, w stepRunWalk, groupID, actorID string) bool {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/actor/groups/"+groupID+"/assignments", nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner reading the group list: %d %s", rec.Code, rec.Body.String())
	}
	for _, row := range decodeObjects(t, rec) {
		if row["actor_id"] == actorID {
			return true
		}
	}
	return false
}

func TestUnassignGroup_EndsOnePersonsRegistrationAndTheirSeatThereOverTheMount(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	ctx := context.Background()
	id, groupID := seatFreshResident(t, w, "Resident Quince")
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: id, GroupID: groupID}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
	if !rosterIncludes(t, w, groupID, id) {
		t.Fatalf("before the removal the resident is not on the group list")
	}
	path := "/instances/" + w.instance + "/actor/actors/" + id + "/assignments/" + groupID

	if rec := w.call(t, "DELETE", path, nil, w.cookieFor(t, id)); rec.Code < 400 {
		t.Fatalf("resident ending their own registration: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if !rosterIncludes(t, w, groupID, id) || activeSeats(t, w, id) != 1 {
		t.Fatalf("a refused call changed the list or the seat")
	}

	if rec := w.call(t, "DELETE", path, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner ending the registration: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rosterIncludes(t, w, groupID, id) {
		t.Errorf("the resident is still on the group list after the registration ended")
	}
	if n := activeSeats(t, w, id); n != 0 {
		t.Errorf("seats after the registration ended: %d active, want 0", n)
	}
	if rec := w.call(t, "DELETE", path, nil, w.owner); rec.Code != http.StatusNotFound {
		t.Errorf("ending a registration twice: %d %s, want 404", rec.Code, rec.Body.String())
	}
}
