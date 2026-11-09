package http

import (
	"context"
	"net/http"
	"testing"

	"wakalaserver/internal/agencies"
	mwanachamaactor "wakalaserver/modules/actor"
)

func TestSeatedAgentGetsTheRolesOfItsGroups(t *testing.T) {
	w := newGroupRoleWalk(t)
	if rec := w.call(t, "POST", "/instances/"+w.instance+"/agents", map[string]any{"user_id": "agent-x"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("add agent: %d", rec.Code)
	}
	agent := w.cookieFor(t, "agent-x")
	links := w.deps.Registry.(agencies.AgencyRoleLinks)
	if err := links.SetAgencyRole(context.Background(), w.instance, "agent-x", w.roles["Reader"]); err != nil {
		t.Fatal(err)
	}
	if got := w.create(t, agent); got != http.StatusForbidden {
		t.Fatalf("a Reader agent creating a task: %d, want 403", got)
	}
	directory := w.directory(t)
	if _, err := directory.EnsureActor(context.Background(), "agent-x"); err != nil {
		t.Fatal(err)
	}
	group := w.group(t, "Dev")
	if _, err := directory.AssignGroup(context.Background(), mwanachamaactor.ActorGroupAssignment{ActorID: "agent-x", GroupID: group}); err != nil {
		t.Fatal(err)
	}
	w.giveRole(t, "Dev", "Worker")
	if got := w.list(t, agent); got != http.StatusOK {
		t.Fatalf("a Reader agent in a Worker group listing tasks: %d, want 200", got)
	}
	if got := w.create(t, agent); got != http.StatusCreated {
		t.Fatalf("a Reader agent in a Worker group creating a task: %d, want 201", got)
	}
}
