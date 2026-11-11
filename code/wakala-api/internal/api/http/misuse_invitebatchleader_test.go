package http

import (
	"context"
	"errors"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/shopauth"
)

func TestMemberInvitationBatch_ClerkNotLeadingTheGroupCannotDoInviteIntoIt(t *testing.T) {
	w := newStepRunWalk(t, referralPlan())
	perms := map[string][]string{"role-clerk": {"join_request.decide", "member.invite"}}
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
	ctx := context.Background()

	led := decodeObject(t, w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Led ward"}, w.owner))
	ledCode := publicCodeOf(t, led)
	ledID, _ := led["id"].(string)
	otherCode := publicCodeOf(t, decodeObject(t, w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Other ward"}, w.owner)))

	clerk := w.cookieFor(t, "agent-clerk")
	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": "agent-clerk"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds agent: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", path+"/members/agent-clerk/agency-role", map[string]any{"agency_role_id": "role-clerk"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner links agent: %d %s", rec.Code, rec.Body.String())
	}

	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	clerkActor, err := um.EnsureActor(ctx, "agent-clerk")
	if err != nil {
		t.Fatalf("EnsureActor: %v", err)
	}
	leaderKind, err := um.CreateRoleKind(ctx, mwanachamaactor.RoleKind{Name: "Ward lead", LeadsGroup: true})
	if err != nil {
		t.Fatalf("CreateRoleKind: %v", err)
	}
	if _, err := um.SetRoleKindLeadsGroup(ctx, leaderKind.ID, true); err != nil {
		t.Fatalf("SetRoleKindLeadsGroup: %v", err)
	}
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: clerkActor.ID, GroupID: ledID, KindID: leaderKind.ID}); err != nil {
		t.Fatalf("GrantRole: %v", err)
	}

	row := func(email, code string) map[string]any {
		return map[string]any{"first_name": "Ben", "last_name": "Kiss", "email": email, "group_code": code}
	}
	send := func(who *http.Cookie, rows ...map[string]any) int {
		return w.call(t, "POST", path+"/invitations/batch", map[string]any{"rows": rows}, who).Code
	}

	if code := send(clerk, row("led@example.test", ledCode)); code != http.StatusOK {
		t.Fatalf("clerk leading the group sending a list into it: %d, want 200", code)
	}
	if code := send(clerk, row("other@example.test", otherCode)); code != http.StatusForbidden {
		t.Fatalf("clerk not leading the group sending a list into it: %d, want 403", code)
	}
	if code := send(clerk, row("mixed-led@example.test", ledCode), row("mixed-other@example.test", otherCode)); code != http.StatusForbidden {
		t.Fatalf("clerk sending a list with one row into a group they do not lead: %d, want 403", code)
	}
	for _, email := range accounts.emails {
		if email == "other@example.test" || email == "mixed-led@example.test" || email == "mixed-other@example.test" {
			t.Fatalf("an account was created for %s from a refused list", email)
		}
	}
	if code := send(w.owner, row("owner-other@example.test", otherCode)); code != http.StatusOK {
		t.Fatalf("owner sending a list into any group: %d, want 200", code)
	}
}

func publicCodeOf(t *testing.T, group map[string]any) string {
	t.Helper()
	code, _ := group["public_code"].(string)
	if code == "" {
		t.Fatalf("group has no public code: %v", group)
	}
	return code
}
