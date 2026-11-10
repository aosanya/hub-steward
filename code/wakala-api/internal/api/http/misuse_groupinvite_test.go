package http

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

func TestGroupInvite_ResidentCannotDoInviteSomeoneToAGroup(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer", "Liaison")
	base := "/instances/" + w.instance + "/actor"
	ctx := context.Background()

	rec := w.call(t, "POST", base+"/groups", map[string]any{"name": "South ward"}, w.owner)
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("owner creates group: %d %s", rec.Code, rec.Body.String())
	}
	var group struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &group); err != nil || group.ID == "" {
		t.Fatalf("group id from create: %v %s", err, rec.Body.String())
	}

	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	invitee, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Neighbour"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, invitee.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}

	leaderKind, err := um.CreateRoleKind(ctx, mwanachamaactor.RoleKind{Name: "Ward lead", LeadsGroup: true})
	if err != nil {
		t.Fatalf("CreateRoleKind: %v", err)
	}
	if _, err := um.SetRoleKindLeadsGroup(ctx, leaderKind.ID, true); err != nil {
		t.Fatalf("SetRoleKindLeadsGroup: %v", err)
	}
	leader, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Ward lead"})
	if err != nil {
		t.Fatalf("CreateActor leader: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, leader.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember leader: %v", err)
	}
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: leader.ID, GroupID: group.ID, KindID: leaderKind.ID}); err != nil {
		t.Fatalf("GrantRole leader: %v", err)
	}
	leaderCookie := w.cookieFor(t, leader.ID)

	invitePath := base + "/groups/" + group.ID + "/invitations"
	body := map[string]any{"actor_id": invitee.ID}
	if rec := w.call(t, "POST", invitePath, body, w.people["Volunteer"]); rec.Code < 400 {
		t.Fatalf("resident inviting someone to the group: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "GET", invitePath, nil, w.owner); rec.Code != http.StatusOK || len(decodeObjects(t, rec)) != 0 {
		t.Fatalf("invitations after the refused invite: %d %s, want none", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "POST", invitePath, body, leaderCookie); rec.Code != http.StatusCreated {
		t.Fatalf("group leader inviting someone to the group: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
