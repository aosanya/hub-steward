package http

import (
	"context"
	"net/http"
	"testing"

	"wakalaserver/internal/shopauth"
)

type invitedAccounts struct{ emails []string }

func (a *invitedAccounts) Invite(_ context.Context, email string) (string, error) {
	a.emails = append(a.emails, email)
	return "invited-" + email, nil
}

func TestMemberInvitation_ResidentCannotDoInviteAnEmailAddress(t *testing.T) {
	w := newStepRunWalk(t, referralPlan())
	accounts := &invitedAccounts{}
	w.deps.MemberAccounts = accounts
	w.deps.CatalogAuth = shopauth.Verifier{URL: "http://127.0.0.1:1", AnonKey: "anon"}
	w.deps.MemberOrigins = []string{"http://localhost:5062"}
	w.handler = NewRouter(w.deps)
	path := "/instances/" + w.instance

	resident := w.cookieFor(t, "resident-a")
	if rec := w.call(t, "POST", path+"/join", map[string]any{}, resident); rec.Code != http.StatusAccepted {
		t.Fatalf("resident asks to join: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", path+"/join-requests/resident-a/approve", map[string]any{}, w.owner); rec.Code != http.StatusNoContent {
		t.Fatalf("owner admits the resident: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", path+"/invitations", map[string]any{"email": "owner-invited@example.test"}, w.owner); rec.Code != http.StatusAccepted {
		t.Fatalf("owner inviting an address: %d %s, want 202", rec.Code, rec.Body.String())
	}
	code := w.call(t, "POST", path+"/invitations", map[string]any{"email": "resident-invited@example.test"}, resident).Code
	if code != http.StatusForbidden && code != http.StatusNotFound {
		t.Fatalf("resident inviting an address: %d, want 403 or 404", code)
	}
}
