package http

import (
	"net/http"
	"strings"
	"testing"
)

func repeatingUpdateBody(title, assigneeID string) map[string]any {
	return map[string]any{
		"title":         title,
		"assignee_kind": "actor",
		"assignee_id":   assigneeID,
		"schedule":      map[string]any{"start": "2099-01-05T08:00:00Z", "zone": "Europe/Budapest", "rule": "FREQ=WEEKLY"},
	}
}

func TestUpdatingARepeatingTaskRefusesAnAssigneeWhoIsNotStaff(t *testing.T) {
	w := newTaskDueDatesWorld(t)
	stranger := w.actors[0]
	created := w.post(t, "/taskmanager/repeating-tasks", repeatingUpdateBody("Water the beds", "test-owner"))
	if created.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", created.Code, created.Body.String())
	}
	id, _ := decodeObject(t, created)["id"].(string)
	path := w.base + "/taskmanager/repeating-tasks/" + id

	refused := w.walk.call(t, "PUT", path, repeatingUpdateBody("Water the beds", stranger), w.walk.owner)
	if refused.Code != http.StatusUnprocessableEntity || !strings.Contains(refused.Body.String(), assigneeRefusalText) {
		t.Fatalf("update to a stranger answered %d %s", refused.Code, refused.Body.String())
	}

	read := w.get(t, "/taskmanager/repeating-tasks/"+id)
	if got, _ := decodeObject(t, read)["assignee_id"].(string); got != "test-owner" {
		t.Fatalf("a refused update changed the assignee to %q", got)
	}

	accepted := w.walk.call(t, "PUT", path, repeatingUpdateBody("Water the beds on Monday", "test-owner"), w.walk.owner)
	if accepted.Code != http.StatusOK {
		t.Fatalf("update to the owner answered %d %s", accepted.Code, accepted.Body.String())
	}
}

func TestTheRepeatingTaskUpdateIsGatedLikeCreateOnItsAssignee(t *testing.T) {
	if !assigneeGatedActions["taskmanager.repeating_task.update"] {
		t.Fatalf("the update action is not gated on its assignee")
	}
	if !assigneeGatedTools["taskmanager_repeating_task_update"] {
		t.Fatalf("the update tool is not gated on its assignee")
	}
}
