package http

import (
	"net/http"
	"testing"
)

func TestRemovedMember_LosesRoleSeatsOutsideTheGroupRoster(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	removedID, _ := seatFreshResident(t, w, "Resident Removed Rho")
	keptID, _ := seatFreshResident(t, w, "Resident Kept Kai")
	if n := activeSeats(t, w, removedID); n != 1 {
		t.Fatalf("seat before removal: %d active, want 1", n)
	}
	rec := w.call(t, "DELETE", "/instances/"+w.instance+"/members/"+removedID, nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner removing the resident from the agency: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if n := activeSeats(t, w, removedID); n != 0 {
		t.Errorf("seats of a removed member: %d active, want 0", n)
	}
	if n := activeSeats(t, w, keptID); n != 1 {
		t.Errorf("seats of a member who was not removed: %d active, want 1", n)
	}
}
