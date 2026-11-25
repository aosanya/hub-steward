package http

import (
	"net/http"
	"testing"
)

type globalRoute struct {
	name   string
	method string
	path   string
	body   map[string]any
	action string
}

var globalTaskManagerRoutes = []globalRoute{
	{"project delete", "DELETE", "/projects/p1", nil, "taskmanager.project.delete"},
	{"project create", "POST", "/projects", map[string]any{"name": "P"}, "taskmanager.project.create"},
	{"backlog create", "POST", "/backlogs", map[string]any{"name": "B"}, "taskmanager.backlog.create"},
	{"agent upsert", "POST", "/agents", map[string]any{"slug": "a"}, "taskmanager.agent.upsert"},
	{"case open", "POST", "/cases", map[string]any{"title": "C"}, "taskmanager.case.open"},
	{"workflow run start", "POST", "/workflow-runs/start", map[string]any{}, "taskmanager.workflow_run.start"},
	{"workflow run create", "POST", "/workflow-runs", map[string]any{}, "taskmanager.workflow_run.create"},
	{"import run", "POST", "/projects/import", map[string]any{}, "taskmanager.import.run"},
	{"import start", "POST", "/projects/import/jobs", map[string]any{}, "taskmanager.import.start"},
	{"repeating task create", "POST", "/repeating-tasks", map[string]any{}, "taskmanager.repeating_task.create"},
	{"owner group", "PUT", "/backlog-owner-group", map[string]any{"group_id": "x"}, "taskmanager.backlog.set_owner_group"},
	{"project list", "GET", "/projects", nil, "taskmanager.project.list"},
	{"agent list", "GET", "/agents", nil, "taskmanager.agent.list"},
}

func TestBacklogAccess_ACanSeeGroupIsRefusedEveryActionThatIsNotAboutItsBacklogs(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, amina := w.resident(t, "Amina", "Support")
	w.backlogWith(t, "see", "Support")
	for _, route := range globalTaskManagerRoutes {
		if code := w.call(t, route.method, w.tm(route.path), route.body, amina).Code; code != http.StatusForbidden {
			t.Errorf("a Can see group calls %s: %d, want 403", route.name, code)
		}
	}
}

func TestBacklogAccess_ACanSeeGroupStillReadsItsBacklogsAndTasks(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, amina := w.resident(t, "Amina", "Support")
	w.backlogWith(t, "see", "Support")
	issue := w.journeyIssue(t, "backlog", "to-do")
	for _, path := range []string{"/backlogs", "/tasks", "/tasks/" + issue, "/board-snapshot", "/pending-tasks"} {
		if code := w.call(t, "GET", w.tm(path), nil, amina).Code; code != http.StatusOK {
			t.Errorf("a Can see group reads %s: %d, want 200", path, code)
		}
	}
}

func TestBacklogAccess_ACanMoveGroupStillMovesItsTasks(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, mia := w.resident(t, "Mia", "Support")
	w.backlogWith(t, "move", "Support")
	issue := w.journeyIssue(t, "backlog", "to-do")
	if code := w.call(t, "POST", w.tm("/tasks/"+issue+"/move-to-step"), map[string]any{"backlog": "backlog", "step": "doing"}, mia).Code; code != http.StatusOK {
		t.Fatalf("a Can move group moves an issue: %d, want 200", code)
	}
	if code := w.create(t, mia); code != http.StatusCreated {
		t.Fatalf("a Can move group creates an issue: %d, want 201", code)
	}
	if code := w.call(t, "POST", w.tm("/projects"), map[string]any{"name": "P"}, mia).Code; code != http.StatusForbidden {
		t.Fatalf("a Can move group creates a project: %d, want 403", code)
	}
}

func TestBacklogAccess_TheToolsOfAGlobalActionRefuseACanSeeGroup(t *testing.T) {
	w := newGroupRoleWalk(t)
	amina, _ := w.resident(t, "Amina", "Support")
	w.backlogWith(t, "see", "Support")
	for _, route := range globalTaskManagerRoutes {
		if err := w.toolRefusal(t, amina, route.action); err == nil {
			t.Errorf("a Can see group calling the tool of %s is admitted", route.name)
		}
	}
	if err := w.toolRefusal(t, amina, "taskmanager.task.list"); err != nil {
		t.Errorf("a Can see group listing issues through a tool is refused: %v", err)
	}
}
