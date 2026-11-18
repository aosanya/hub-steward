package http

import (
	"context"
	"net/http"
	"testing"

	"wakalaserver/internal/agencies"
)

func (w stepRunWalk) addAgent(t *testing.T, subject, displayName string) *http.Cookie {
	t.Helper()
	cookie := w.cookieFor(t, subject)
	rec := w.call(t, "POST", "/instances/"+w.instance+"/agents", map[string]any{"user_id": subject}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("owner adds agent %s: %d %s", subject, rec.Code, rec.Body.String())
	}
	if displayName != "" {
		ctx := context.Background()
		directory, err := w.deps.Registry.ActorManager(ctx, w.instance)
		if err != nil {
			t.Fatalf("ActorManager: %v", err)
		}
		if _, err := directory.EnsureActor(ctx, subject); err != nil {
			t.Fatalf("EnsureActor %s: %v", subject, err)
		}
		if _, err := directory.SetActorDisplayName(ctx, subject, displayName); err != nil {
			t.Fatalf("SetActorDisplayName %s: %v", subject, err)
		}
	}
	return cookie
}

func (w stepRunWalk) linkAgent(t *testing.T, subject, role string) {
	t.Helper()
	rec := w.call(t, "PUT", "/instances/"+w.instance+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": w.roles[role]}, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner links %s to %s: %d %s", subject, role, rec.Code, rec.Body.String())
	}
}

func refusedStep(code int) bool {
	return code == http.StatusForbidden || code == http.StatusNotFound
}

func TestAnAgentLinkedToTheMayorsRoleCompletesTheMayorsApproval(t *testing.T) {
	w := noticeWalk(t)
	agent := w.addAgent(t, "agent-mayor", "Mayor's desk assistant")
	w.linkAgent(t, "agent-mayor", "Mayor")

	sent := w.submit(t, agent, "Approve the notice", map[string]string{"Decision": "yes"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the agent in the mayor's role approves: %d %s, want 201 (the owner's rule: a workflow is a workflow)", sent.Code, sent.Body.String())
	}
	answers := answersOfSent(t, w.sentSteps(t, agent, "")[0])
	if answers[approvedByPrompt] != "Mayor's desk assistant" {
		t.Errorf("%s = %v, want the agent's own name", approvedByPrompt, answers[approvedByPrompt])
	}
	if filing := w.available(t, w.people["Clerk"]); len(filing) != 1 || filing[0]["title"] != "File the notice" {
		t.Errorf("after the agent's approval the clerk sees %v, want the filing step", titles(filing))
	}
}

func TestAnAgentWithoutAProfileNameCannotStampAnApproval(t *testing.T) {
	w := noticeWalk(t)
	agent := w.addAgent(t, "agent-nameless", "")
	w.linkAgent(t, "agent-nameless", "Mayor")

	rec := w.submit(t, agent, "Approve the notice", map[string]string{"Decision": "yes"}, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("a nameless agent approves: %d %s, want 400 asking for a name, never a silent approval", rec.Code, rec.Body.String())
	}
	if open := w.available(t, w.people["Mayor"]); len(open) != 1 || open[0]["title"] != "Approve the notice" {
		t.Errorf("the mayor's approval step is no longer open: %v", titles(open))
	}
}

func TestAnAgentWithoutTheMayorsRoleIsRefusedTheMayorsApproval(t *testing.T) {
	w := noticeWalk(t)
	unlinked := w.addAgent(t, "agent-unlinked", "Unlinked assistant")
	clerkAgent := w.addAgent(t, "agent-clerk", "Clerk's assistant")
	w.linkAgent(t, "agent-clerk", "Clerk")

	for name, as := range map[string]*http.Cookie{"an agent with no role": unlinked, "an agent in the clerk's role": clerkAgent} {
		rec := w.submit(t, as, "Approve the notice", map[string]string{"Decision": "yes"}, "")
		if !refusedStep(rec.Code) {
			t.Errorf("%s approves the mayor's step: %d %s, want 403 or 404", name, rec.Code, rec.Body.String())
		}
	}
	if open := w.available(t, w.people["Mayor"]); len(open) != 1 || open[0]["title"] != "Approve the notice" {
		t.Errorf("the mayor's approval step is no longer open after the refusals: %v", titles(open))
	}
}

func TestAResidentWithoutTheMayorsRoleIsRefusedTheMayorsApproval(t *testing.T) {
	w := noticeWalk(t)
	resident := w.cookieFor(t, "resident-eva")
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "resident-eva", agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	rec := w.submit(t, resident, "Approve the notice", map[string]string{"Decision": "yes"}, "")
	if !refusedStep(rec.Code) {
		t.Errorf("a resident approves the mayor's step: %d %s, want 403 or 404", rec.Code, rec.Body.String())
	}
}
