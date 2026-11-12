package http

import (
	"context"
	"errors"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/shopauth"
)

type clerkDesk struct {
	w        stepRunWalk
	path     string
	groupID  string
	groupKey string
	accounts *invitedAccounts
}

func newClerkDesk(t *testing.T) clerkDesk {
	t.Helper()
	w := newStepRunWalk(t, referralPlan(), "Volunteer", "Liaison", "Coordinator")
	perms := map[string][]string{
		w.roles["Volunteer"]:   {"join_request.decide", "member.invite"},
		w.roles["Liaison"]:     {"report.publish"},
		w.roles["Coordinator"]: {"join_request.operate"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		p, ok := perms[roleID]
		if !ok {
			return nil, errors.New("unknown role")
		}
		return p, nil
	}
	accounts := &invitedAccounts{}
	w.deps.MemberAccounts = accounts
	w.deps.CatalogAuth = shopauth.Verifier{URL: "http://127.0.0.1:1", AnonKey: "anon"}
	w.deps.MemberOrigins = []string{"http://localhost:5062"}
	w.handler = NewRouter(w.deps)
	path := "/instances/" + w.instance
	group := decodeObject(t, w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Kertváros"}, w.owner))
	groupID, _ := group["id"].(string)
	return clerkDesk{w: w, path: path, groupID: groupID, groupKey: publicCodeOf(t, group), accounts: accounts}
}

func (d clerkDesk) askToJoinTheGroup(t *testing.T, name string) string {
	t.Helper()
	applicant := d.w.cookieFor(t, name)
	rec := d.w.call(t, "POST", d.path+"/actor/groups/"+d.groupID+"/join", map[string]any{}, applicant)
	if rec.Code >= 400 {
		t.Fatalf("%s asks to join the group: %d %s", name, rec.Code, rec.Body.String())
	}
	joined := decodeObject(t, rec)
	request, _ := joined["request"].(map[string]any)
	id, _ := request["id"].(string)
	if id == "" {
		t.Fatalf("request id from join: %s", rec.Body.String())
	}
	return id
}

func (d clerkDesk) askToJoinTheAgency(t *testing.T, name string) {
	t.Helper()
	if rec := d.w.call(t, "PUT", d.path+"/join-mode", map[string]any{"join_mode": "confirmed"}, d.w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner sets confirmed join mode: %d %s", rec.Code, rec.Body.String())
	}
	if rec := d.w.call(t, "POST", d.path+"/join", map[string]any{"message": "I live on Mill Row"}, d.w.cookieFor(t, name)); rec.Code != http.StatusAccepted {
		t.Fatalf("%s asks to join the agency: %d %s", name, rec.Code, rec.Body.String())
	}
}

func (d clerkDesk) makeLeader(t *testing.T, name string) {
	t.Helper()
	ctx := context.Background()
	um, err := d.w.deps.Registry.ActorManager(ctx, d.w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	people, err := um.ListActors(ctx)
	if err != nil {
		t.Fatalf("ListActors: %v", err)
	}
	var actorID string
	for _, a := range people {
		if a.DisplayName == name {
			actorID = a.ID
		}
	}
	if actorID == "" {
		t.Fatalf("no actor named %s", name)
	}
	kind, err := um.CreateRoleKind(ctx, mwanachamaactor.RoleKind{Name: "Ward lead", LeadsGroup: true})
	if err != nil {
		t.Fatalf("CreateRoleKind: %v", err)
	}
	if _, err := um.SetRoleKindLeadsGroup(ctx, kind.ID, true); err != nil {
		t.Fatalf("SetRoleKindLeadsGroup: %v", err)
	}
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: actorID, GroupID: d.groupID, KindID: kind.ID}); err != nil {
		t.Fatalf("GrantRole: %v", err)
	}
}

func (d clerkDesk) invitationRows(email string) map[string]any {
	return map[string]any{"rows": []map[string]any{{"first_name": "Ben", "last_name": "Kiss", "email": email, "group_code": d.groupKey}}}
}

func TestRoleHolder_APersonHoldingJoinRequestDecideApprovesAGroupJoinRequest(t *testing.T) {
	d := newClerkDesk(t)
	requestID := d.askToJoinTheGroup(t, "applicant-ben")

	approve := d.path + "/actor/join-requests/" + requestID + "/approve"
	if rec := d.w.call(t, "POST", approve, map[string]any{}, d.w.people["Volunteer"]); rec.Code >= 300 {
		t.Fatalf("resident holding join_request.decide approving a group join request: %d %s, want success", rec.Code, rec.Body.String())
	}
}

func TestRoleHolder_APersonHoldingJoinRequestDecideDeclinesAGroupJoinRequest(t *testing.T) {
	d := newClerkDesk(t)
	requestID := d.askToJoinTheGroup(t, "applicant-ben")

	decline := d.path + "/actor/join-requests/" + requestID + "/decline"
	if rec := d.w.call(t, "POST", decline, map[string]any{}, d.w.people["Volunteer"]); rec.Code >= 300 {
		t.Fatalf("resident holding join_request.decide declining a group join request: %d %s, want success", rec.Code, rec.Body.String())
	}
}

func TestRoleHolder_APersonWithoutJoinRequestDecideIsRefusedDecidingAGroupJoinRequest(t *testing.T) {
	d := newClerkDesk(t)
	requestID := d.askToJoinTheGroup(t, "applicant-ben")

	for _, action := range []string{"approve", "decline"} {
		path := d.path + "/actor/join-requests/" + requestID + "/" + action
		for _, name := range []string{"Liaison", "Coordinator"} {
			if rec := d.w.call(t, "POST", path, map[string]any{}, d.w.people[name]); rec.Code < 400 {
				t.Fatalf("resident without join_request.decide calling %s: %d %s, want refused", action, rec.Code, rec.Body.String())
			}
		}
	}
}

func TestRoleHolder_APersonHoldingJoinRequestOperateListsAGroupsJoinRequests(t *testing.T) {
	d := newClerkDesk(t)
	d.askToJoinTheGroup(t, "applicant-ben")

	list := d.path + "/actor/groups/" + d.groupID + "/join-requests"
	if rec := d.w.call(t, "GET", list, nil, d.w.people["Coordinator"]); rec.Code != http.StatusOK {
		t.Fatalf("resident holding join_request.operate listing a group's join requests: %d %s, want 200", rec.Code, rec.Body.String())
	}
	for _, name := range []string{"Volunteer", "Liaison"} {
		if rec := d.w.call(t, "GET", list, nil, d.w.people[name]); rec.Code < 400 {
			t.Fatalf("resident without join_request.operate listing a group's join requests: %d %s, want refused", rec.Code, rec.Body.String())
		}
	}
}

func TestRoleHolder_APersonHoldingJoinRequestDecideApprovesAnAgencyJoinRequest(t *testing.T) {
	d := newClerkDesk(t)
	d.askToJoinTheAgency(t, "applicant-ben")

	if rec := d.w.call(t, "GET", d.path+"/join-requests", nil, d.w.people["Volunteer"]); rec.Code != http.StatusOK {
		t.Fatalf("resident holding join_request.decide listing the agency's join requests: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := d.w.call(t, "POST", d.path+"/join-requests/applicant-ben/approve", nil, d.w.people["Volunteer"]); rec.Code != http.StatusNoContent {
		t.Fatalf("resident holding join_request.decide approving an agency join request: %d %s, want 204", rec.Code, rec.Body.String())
	}
}

func TestRoleHolder_APersonWithoutJoinRequestDecideIsRefusedDecidingAnAgencyJoinRequest(t *testing.T) {
	d := newClerkDesk(t)
	d.askToJoinTheAgency(t, "applicant-ben")

	for _, name := range []string{"Liaison", "Coordinator"} {
		if rec := d.w.call(t, "GET", d.path+"/join-requests", nil, d.w.people[name]); rec.Code < 400 {
			t.Fatalf("resident without join_request.decide listing the agency's join requests: %d %s, want refused", rec.Code, rec.Body.String())
		}
		if rec := d.w.call(t, "POST", d.path+"/join-requests/applicant-ben/approve", nil, d.w.people[name]); rec.Code < 400 {
			t.Fatalf("resident without join_request.decide approving an agency join request: %d %s, want refused", rec.Code, rec.Body.String())
		}
	}
}

func TestRoleHolder_APersonHoldingMemberInviteInvitesAnAddress(t *testing.T) {
	d := newClerkDesk(t)

	rec := d.w.call(t, "POST", d.path+"/invitations", map[string]any{"email": "clerk-invited@example.test"}, d.w.people["Volunteer"])
	if rec.Code != http.StatusAccepted {
		t.Fatalf("resident holding member.invite inviting an address: %d %s, want 202", rec.Code, rec.Body.String())
	}
}

func TestRoleHolder_APersonWithoutMemberInviteIsRefusedInvitingAnAddress(t *testing.T) {
	d := newClerkDesk(t)

	for _, name := range []string{"Liaison", "Coordinator"} {
		if rec := d.w.call(t, "POST", d.path+"/invitations", map[string]any{"email": name + "@example.test"}, d.w.people[name]); rec.Code < 400 {
			t.Fatalf("resident without member.invite inviting an address: %d %s, want refused", rec.Code, rec.Body.String())
		}
	}
	if len(d.accounts.emails) != 0 {
		t.Fatalf("accounts were created for refused invitations: %v", d.accounts.emails)
	}
}

func TestRoleHolder_APersonHoldingMemberInviteLeadingTheGroupInvitesAList(t *testing.T) {
	d := newClerkDesk(t)
	d.makeLeader(t, "Volunteer")

	rec := d.w.call(t, "POST", d.path+"/invitations/batch", d.invitationRows("led-batch@example.test"), d.w.people["Volunteer"])
	if rec.Code != http.StatusOK {
		t.Fatalf("resident holding member.invite and leading the group sending a list: %d %s, want 200", rec.Code, rec.Body.String())
	}
}

func TestRoleHolder_APersonHoldingMemberInviteNotLeadingTheGroupIsRefusedInvitingAList(t *testing.T) {
	d := newClerkDesk(t)

	rec := d.w.call(t, "POST", d.path+"/invitations/batch", d.invitationRows("unled-batch@example.test"), d.w.people["Volunteer"])
	if rec.Code != http.StatusForbidden {
		t.Fatalf("resident holding member.invite not leading the group sending a list: %d %s, want 403", rec.Code, rec.Body.String())
	}
}

func TestRoleHolder_APersonWithoutMemberInviteLeadingTheGroupIsRefusedInvitingAList(t *testing.T) {
	d := newClerkDesk(t)
	d.makeLeader(t, "Liaison")

	rec := d.w.call(t, "POST", d.path+"/invitations/batch", d.invitationRows("liaison-batch@example.test"), d.w.people["Liaison"])
	if rec.Code < 400 {
		t.Fatalf("resident leading the group but without member.invite sending a list: %d %s, want refused", rec.Code, rec.Body.String())
	}
}
