package http

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"wakalaserver/internal/shopauth"
)

func TestMemberInvitation_MayorAgentCannotDoInviteAnEmailAddress(t *testing.T) {
	w := newStepRunWalk(t, referralPlan())
	perms := map[string][]string{
		"role-mayor": {"report.publish"},
		"role-clerk": {"join_request.decide", "member.invite"},
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

	agent := func(subject, roleID string) *http.Cookie {
		c := w.cookieFor(t, subject)
		if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": subject}, w.owner); rec.Code != http.StatusCreated {
			t.Fatalf("owner adds agent %s: %d %s", subject, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "PUT", path+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": roleID}, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("owner links %s to %s: %d %s", subject, roleID, rec.Code, rec.Body.String())
		}
		return c
	}
	mayor := agent("agent-mayor", "role-mayor")
	clerk := agent("agent-clerk", "role-clerk")

	invite := func(who *http.Cookie, email string) int {
		return w.call(t, "POST", path+"/invitations", map[string]any{"email": email}, who).Code
	}
	if code := invite(clerk, "clerk-invited@example.test"); code != http.StatusAccepted {
		t.Fatalf("clerk agent holding member.invite inviting an address: %d, want 202", code)
	}
	if code := invite(mayor, "mayor-invited@example.test"); code != http.StatusForbidden && code != http.StatusNotFound {
		t.Fatalf("mayor agent without member.invite inviting an address: %d, want 403 or 404", code)
	}
	for _, email := range accounts.emails {
		if email == "mayor-invited@example.test" {
			t.Fatalf("an account was created for an address invited by a role without member.invite")
		}
	}
}

func TestMemberInvitationBatch_MayorAgentCannotDoInviteAList(t *testing.T) {
	w := newStepRunWalk(t, referralPlan())
	perms := map[string][]string{
		"role-mayor": {"report.publish"},
		"role-clerk": {"join_request.decide", "member.invite"},
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

	group := decodeObject(t, w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Ward"}, w.owner))
	code, _ := group["public_code"].(string)
	if code == "" {
		t.Fatalf("owner creates a group: %v", group)
	}
	agent := func(subject, roleID string) *http.Cookie {
		c := w.cookieFor(t, subject)
		if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": subject}, w.owner); rec.Code != http.StatusCreated {
			t.Fatalf("owner adds agent %s: %d %s", subject, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "PUT", path+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": roleID}, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("owner links %s to %s: %d %s", subject, roleID, rec.Code, rec.Body.String())
		}
		return c
	}
	mayor := agent("agent-mayor", "role-mayor")
	agent("agent-clerk", "role-clerk")
	rows := func(email string) map[string]any {
		return map[string]any{"rows": []map[string]any{{"first_name": "Ben", "last_name": "Kiss", "email": email, "group_code": code}}}
	}

	if rec := w.call(t, "POST", path+"/invitations/batch", rows("owner-batch@example.test"), w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner sending a list: %d %s, want 200", rec.Code, rec.Body.String())
	}
	rec := w.call(t, "POST", path+"/invitations/batch", rows("mayor-batch@example.test"), mayor)
	if rec.Code != http.StatusForbidden && rec.Code != http.StatusNotFound {
		t.Fatalf("mayor agent without member.invite sending a list: %d %s, want 403 or 404", rec.Code, rec.Body.String())
	}
}
