package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/agencies"
)

func seatFreshResident(t *testing.T, w stepRunWalk, name string) (string, string) {
	t.Helper()
	ctx := context.Background()
	path := "/instances/" + w.instance
	groups := w.call(t, "GET", path+"/actor/groups", nil, w.owner)
	if groups.Code != http.StatusOK {
		t.Fatalf("owner lists groups: %d %s", groups.Code, groups.Body.String())
	}
	list := decodeObjects(t, groups)
	if len(list) == 0 {
		t.Fatalf("no group to seat in")
	}
	groupID, _ := list[0]["id"].(string)
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	resident, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, resident.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	published, err := mgr.GetRole(ctx, w.roles["Volunteer"])
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	kind, err := um.RoleKindForDefinitionRole(ctx, definitionRoleID(agencymodels.DocumentRole{ID: published.ID, Code: published.Code}))
	if err != nil {
		t.Fatalf("RoleKindForDefinitionRole: %v", err)
	}
	body := map[string]any{"actor_id": resident.ID, "group_id": groupID, "kind_id": kind.ID}
	if rec := w.call(t, "POST", path+"/actor/role-assignments", body, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner seating the resident: %d %s, want 201", rec.Code, rec.Body.String())
	}
	return resident.ID, groupID
}

func activeSeats(t *testing.T, w stepRunWalk, actorID string) int {
	t.Helper()
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	seats, err := um.ListRoleAssignmentsForActor(ctx, actorID, false)
	if err != nil {
		t.Fatalf("ListRoleAssignmentsForActor: %v", err)
	}
	n := 0
	for _, s := range seats {
		if s.Active {
			n++
		}
	}
	return n
}

func TestRoleSeat_GroupRemovedResidentCannotDoKeepGroupSeat(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	ctx := context.Background()
	id, groupID := seatFreshResident(t, w, "Resident Umber")
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: id, GroupID: groupID}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
	remove := "/instances/" + w.instance + "/members/" + id + "/groups/" + groupID
	if rec := w.call(t, "DELETE", remove, nil, w.cookieFor(t, id)); rec.Code < 400 {
		t.Fatalf("resident removing themselves from the group: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if n := activeSeats(t, w, id); n != 1 {
		t.Fatalf("seat after refused removal: %d active, want 1", n)
	}
	if rec := w.call(t, "DELETE", remove, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner removing the resident from the group: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if n := activeSeats(t, w, id); n != 0 {
		t.Fatalf("seat after group removal: %d active, want 0", n)
	}
}
