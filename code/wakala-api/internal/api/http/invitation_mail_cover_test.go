package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/invitemail"
	"wakalaserver/internal/shopauth"
	actormodels "wakalaserver/modules/actor/models"
)

type captureSender struct {
	messages chan invitemail.Message
	err      error
}

func newCaptureSender(err error) *captureSender {
	return &captureSender{messages: make(chan invitemail.Message, 4), err: err}
}

func (c *captureSender) Send(_ context.Context, m invitemail.Message) error {
	c.messages <- m
	return c.err
}

func projectReturning(t *testing.T, email string, paths chan<- string) shopauth.Verifier {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if paths != nil {
			paths <- r.Method + " " + r.URL.Path + "?" + r.URL.RawQuery
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"email":"` + email + `"}`))
	}))
	t.Cleanup(server.Close)
	return shopauth.Verifier{URL: server.URL, AnonKey: "anon"}
}

func requestAs(caller, token string) *http.Request {
	r := httptest.NewRequest(http.MethodPost, "/invite", nil)
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	return r.WithContext(accounts.WithID(r.Context(), caller))
}

func actorNamed(t *testing.T, w applyWorld, actor actormodels.Actor) string {
	t.Helper()
	directory, err := w.reg.ActorManager(w.ctx, w.instanceID)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	created, err := directory.CreateActor(w.ctx, actor)
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	return created.ID
}

func TestInvitationMailIsReadyOnlyWithASender(t *testing.T) {
	var none *InvitationMail
	if none.ready() {
		t.Fatal("a missing mail setup must not be ready")
	}
	if (&InvitationMail{}).ready() {
		t.Fatal("a setup with no sender must not be ready")
	}
	if !(&InvitationMail{Sender: newCaptureSender(nil)}).ready() {
		t.Fatal("a setup with a sender must be ready")
	}
}

func TestInvitationDescribesAgencySenderRoleAndTheSignedInContact(t *testing.T) {
	w := newApplyWorld(t)
	caller := actorNamed(t, w, actormodels.Actor{FirstName: "Amina", LastName: "Okoth"})
	if err := w.reg.AddMember(w.ctx, w.instanceID, caller, agencies.RoleOwner); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	mail := &InvitationMail{Sender: newCaptureSender(nil), Misuse: "misuse@town.example", FallbackContact: "desk@town.example"}
	project := projectReturning(t, "  Amina.Okoth@Town.Example ", nil)

	in := mail.describe(requestAs(caller, "tok"), w.reg, project, w.instanceID, "guest@example.org", "https://app.example/")

	if in.Agency != "Town hall" || in.Recipient != "guest@example.org" || in.OpenURL != "https://app.example/" {
		t.Fatalf("agency, recipient or link wrong: %+v", in)
	}
	if in.Sender != "Amina Okoth" {
		t.Fatalf("the sender is named by the actor's own name, got %q", in.Sender)
	}
	if in.SenderRole == "" {
		t.Fatalf("the sender's role in the agency must be given, got %+v", in)
	}
	if in.Contact != "amina.okoth@town.example" {
		t.Fatalf("the contact is the signed-in email, lower-cased and trimmed, got %q", in.Contact)
	}
	if in.Misuse != "misuse@town.example" {
		t.Fatalf("misuse address lost: %q", in.Misuse)
	}
}

func TestInvitationContactFallsBackToTheDeskThenToTheMisuseAddress(t *testing.T) {
	w := newApplyWorld(t)
	noProject := shopauth.Verifier{}

	withDesk := (&InvitationMail{Misuse: "misuse@town.example", FallbackContact: "desk@town.example"}).
		describe(requestAs("owner-1", ""), w.reg, noProject, w.instanceID, "a@b.c", "https://x/")
	if withDesk.Contact != "desk@town.example" {
		t.Fatalf("no signed-in email: the desk contact is used, got %q", withDesk.Contact)
	}

	misuseOnly := (&InvitationMail{Misuse: "misuse@town.example"}).
		describe(requestAs("owner-1", "tok"), w.reg, noProject, w.instanceID, "a@b.c", "https://x/")
	if misuseOnly.Contact != "misuse@town.example" {
		t.Fatalf("no desk either: the misuse address is the contact, got %q", misuseOnly.Contact)
	}
}

func TestInvitationSenderNameFallsBackFromFullNameToDisplayNameToContactToOperator(t *testing.T) {
	w := newApplyWorld(t)
	displayed := actorNamed(t, w, actormodels.Actor{DisplayName: "Anna K."})
	anonymous := actorNamed(t, w, actormodels.Actor{})

	cases := []struct {
		caller, contact, want string
	}{
		{displayed, "desk@town.example", "Anna K."},
		{anonymous, "desk@town.example", "desk@town.example"},
		{"nobody-by-that-id", "", "An operator"},
	}
	for _, c := range cases {
		if got := inviterName(w.ctx, w.reg, w.instanceID, c.caller, c.contact); got != c.want {
			t.Errorf("caller %q contact %q: got %q, want %q", c.caller, c.contact, got, c.want)
		}
	}
}

func TestInvitationUnknownAgencyLeavesTheNameAndRoleEmpty(t *testing.T) {
	w := newApplyWorld(t)
	in := (&InvitationMail{Misuse: "m@x"}).describe(requestAs("owner-1", ""), w.reg, shopauth.Verifier{}, "no-such-agency", "a@b.c", "https://x/")
	if in.Agency != "" || in.SenderRole != "" {
		t.Fatalf("an unknown agency gives no name and no role, got %+v", in)
	}
}

func newReservingSender(project shopauth.Verifier) *magicLinkSender {
	s := newMagicLinkSender(project, []string{"https://app.example"})
	return s
}

func TestInvitationIsSentAsMailWhenMailIsSetUp(t *testing.T) {
	w := newApplyWorld(t)
	sender := newCaptureSender(nil)
	links := newReservingSender(shopauth.Verifier{})
	links.slots <- struct{}{}
	m := memberInvitations{reg: w.reg, links: links, mail: &InvitationMail{Sender: sender, Misuse: "m@x", FallbackContact: "desk@town.example"}}

	m.deliver(requestAs("owner-1", ""), w.instanceID, "guest@example.org", "https://app.example/")

	select {
	case got := <-sender.messages:
		if got.To != "guest@example.org" || got.Subject != "You are invited to Town hall" {
			t.Fatalf("message wrong: %+v", got)
		}
		if !strings.Contains(got.Body, "https://app.example/") || !strings.Contains(got.Body, "desk@town.example") {
			t.Fatalf("the body must carry the link and the contact: %q", got.Body)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the invitation email was never sent")
	}
	waitForRelease(t, links)
}

func TestInvitationSendFailureIsSwallowedAndTheSlotReleased(t *testing.T) {
	w := newApplyWorld(t)
	sender := newCaptureSender(errors.New("smtp down"))
	links := newReservingSender(shopauth.Verifier{})
	links.slots <- struct{}{}
	m := memberInvitations{reg: w.reg, links: links, mail: &InvitationMail{Sender: sender, Misuse: "m@x"}}

	m.deliver(requestAs("owner-1", ""), w.instanceID, "guest@example.org", "https://app.example/")

	select {
	case <-sender.messages:
	case <-time.After(5 * time.Second):
		t.Fatal("the send was never attempted")
	}
	waitForRelease(t, links)
}

func TestInvitationFallsBackToTheMagicLinkWhenNoMailIsSetUp(t *testing.T) {
	w := newApplyWorld(t)
	paths := make(chan string, 2)
	links := newReservingSender(projectReturning(t, "x@y.z", paths))
	outcome := make(chan error, 1)
	links.sent = func(err error) { outcome <- err }
	links.slots <- struct{}{}
	m := memberInvitations{reg: w.reg, links: links}

	m.deliver(requestAs("owner-1", ""), w.instanceID, "guest@example.org", "https://app.example/")

	select {
	case err := <-outcome:
		if err != nil {
			t.Fatalf("the magic link send failed: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("no magic link was sent")
	}
	if got := <-paths; !strings.HasPrefix(got, "POST /auth/v1/otp?") || !strings.Contains(got, "redirect_to=https%3A%2F%2Fapp.example%2F") {
		t.Fatalf("the project's sign-in was called wrongly: %q", got)
	}
	waitForRelease(t, links)
}

func waitForRelease(t *testing.T, s *magicLinkSender) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if len(s.slots) == 0 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("the in-flight slot was never released")
}
