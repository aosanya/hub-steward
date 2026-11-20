package http

import (
	"context"
	"net/http"
	"strings"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
)

type poolPersonWorld struct {
	walk   stepRunWalk
	base   string
	person string
	group  string
	task   string
}

func newPoolPersonWorld(t *testing.T) *poolPersonWorld {
	t.Helper()
	walk := newStepRunWalk(t, nil)
	w := &poolPersonWorld{walk: walk, base: "/instances/" + walk.instance}
	ctx := context.Background()
	um, err := walk.deps.Registry.ActorManager(ctx, walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	person, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Pool person"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	w.person = person.ID
	group := walk.call(t, "POST", w.base+"/actor/groups", map[string]any{"name": "Pool team"}, walk.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	w.group, _ = decodeObject(t, group)["id"].(string)
	joined := walk.call(t, "POST", w.base+"/actor/actors/"+w.person+"/assignments", map[string]any{"group_id": w.group}, walk.owner)
	if joined.Code >= 300 {
		t.Fatalf("register in the team group: %d %s", joined.Code, joined.Body.String())
	}
	created := walk.call(t, "POST", w.base+"/taskmanager/tasks", map[string]any{"title": "Review the plan"}, walk.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("create task: %d %s", created.Code, created.Body.String())
	}
	w.task, _ = decodeObject(t, created)["id"].(string)
	return w
}

func (w *poolPersonWorld) assign(t *testing.T) (int, string) {
	t.Helper()
	rec := w.walk.call(t, "POST", w.base+"/taskmanager/tasks/"+w.task+"/assign-holder", map[string]any{"assignee_kind": "actor", "assignee_id": w.person}, w.walk.owner)
	return rec.Code, rec.Body.String()
}

func (w *poolPersonWorld) seatInStaffRole(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	um, err := w.walk.deps.Registry.ActorManager(ctx, w.walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	kind, err := um.CreateRoleKind(ctx, mwanachamaactor.RoleKind{Name: "Pool consultant", Staff: true})
	if err != nil {
		t.Fatalf("CreateRoleKind: %v", err)
	}
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: w.person, GroupID: w.group, KindID: kind.ID}); err != nil {
		t.Fatalf("GrantRole: %v", err)
	}
}

func (w *poolPersonWorld) noticeEventsFor(t *testing.T) []string {
	t.Helper()
	cm, err := w.walk.deps.Registry.CommManager(context.Background(), w.walk.instance)
	if err != nil {
		t.Fatalf("CommManager: %v", err)
	}
	rows, err := cm.NotificationStore.List(context.Background(), w.person, 20)
	if err != nil {
		t.Fatalf("list notices: %v", err)
	}
	events := []string{}
	for _, row := range rows {
		events = append(events, string(row.Event))
	}
	return events
}

func TestAnActorInATeamGroupWithNoSeatIsRefusedATask(t *testing.T) {
	w := newPoolPersonWorld(t)

	code, body := w.assign(t)

	if code != http.StatusUnprocessableEntity || !strings.Contains(body, assigneeRefusalText) {
		t.Fatalf("assigning a seatless actor answered %d %s", code, body)
	}
	if got := w.noticeEventsFor(t); len(got) != 0 {
		t.Fatalf("a refused assignment left notices %v", got)
	}
}

func TestAnActorWithAStaffSeatAndNoMembershipIsGivenATaskAndToldOfIt(t *testing.T) {
	w := newPoolPersonWorld(t)
	w.seatInStaffRole(t)

	code, body := w.assign(t)

	if code != http.StatusNoContent {
		t.Fatalf("assigning a staff seat holder answered %d %s", code, body)
	}
	held := decodeObject(t, w.walk.call(t, "GET", w.base+"/taskmanager/tasks/"+w.task, nil, w.walk.owner))
	if held["assigned_to"] != w.person || held["assignee_kind"] != "actor" {
		t.Fatalf("the task is held by %v (%v), want the pool person as an actor", held["assigned_to"], held["assignee_kind"])
	}
	if got := w.noticeEventsFor(t); len(got) != 1 || got[0] != "task_assigned" {
		t.Fatalf("the pool person was told %v, want one task_assigned", got)
	}
}

func TestAnEventTheHostDoesNotDeclareCannotBeRaisedByHand(t *testing.T) {
	w := newPoolPersonWorld(t)
	w.seatInStaffRole(t)

	rec := w.walk.call(t, "POST", w.base+"/comm/notifications", map[string]any{
		"recipient_id": w.person,
		"category":     "task",
		"event":        "project.staffed",
		"subject_kind": "task",
		"subject_id":   w.task,
	}, w.walk.owner)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("raising an undeclared event answered %d %s", rec.Code, rec.Body.String())
	}
	if got := w.noticeEventsFor(t); len(got) != 0 {
		t.Fatalf("a refused raise left notices %v", got)
	}
}
