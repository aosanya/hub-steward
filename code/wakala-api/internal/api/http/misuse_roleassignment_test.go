package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/agencies"
)

func TestRoleAssignment_ResidentCannotDoGrantThemselvesARole(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
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
	resident, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Resident Quill"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, resident.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	residentCookie := w.cookieFor(t, resident.ID)
	published, err := mgr.GetRole(ctx, w.roles["Volunteer"])
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	kind, err := um.RoleKindForDefinitionRole(ctx, definitionRoleID(agencymodels.DocumentRole{ID: published.ID, Code: published.Code}))
	if err != nil {
		t.Fatalf("RoleKindForDefinitionRole: %v", err)
	}

	body := map[string]any{"actor_id": resident.ID, "group_id": groupID, "kind_id": kind.ID}
	if rec := w.call(t, "POST", path+"/actor/role-assignments", body, residentCookie); rec.Code < 400 {
		t.Fatalf("resident granting themselves a seat: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", path+"/actor/role-assignments", body, w.people["Volunteer"]); rec.Code < 400 {
		t.Fatalf("seated resident granting another resident a seat: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "POST", path+"/actor/role-assignments", body, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner granting the resident a seat: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
