package http

import (
	"net/http/httptest"
	"testing"
)

func TestToolList_AResidentWhoseGroupHoldsARoleKeepsTheToolsOfHerOwnSteps(t *testing.T) {
	w := newGroupRoleWalk(t)
	runsModules(t, w.instance, "agency", "forms", "actor", "taskmanager")
	_, amina := w.resident(t, "Amina", "Support")
	w.giveRole(t, "Support", "Reader")
	server := httptest.NewServer(w.handler)
	t.Cleanup(server.Close)

	seen := toolsOverMCP(t, server.URL, amina)

	for _, tool := range []string{"agency_list_my_open_steps", "forms_form_list_waiting"} {
		if !contains(seen, tool) {
			t.Errorf("a resident whose group holds a role that reads tasks cannot see %s, it sees %d tools", tool, len(seen))
		}
	}
}

func TestToolList_AResidentWhoseGroupHoldsARoleDoesNotSeeModulesTheRoleHasNoRightIn(t *testing.T) {
	w := newGroupRoleWalk(t)
	runsModules(t, w.instance, "agency", "forms", "actor", "taskmanager", "accounting")
	_, amina := w.resident(t, "Amina", "Support")
	w.giveRole(t, "Support", "Reader")
	server := httptest.NewServer(w.handler)
	t.Cleanup(server.Close)

	seen := toolsOverMCP(t, server.URL, amina)

	if leaked := moduleToolsOutside(seen, "agency", "forms", "actor", "taskmanager", "instance", "digitaltwin"); len(leaked) != 0 {
		t.Errorf("a resident whose group holds a task-reading role sees %d tools of modules the role has no right in, first %v", len(leaked), firstFive(leaked))
	}
}
