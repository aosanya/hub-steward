package http

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"wakalaserver/internal/agencies"
)

const listGroupsTool = "actor_list_groups"
const listGroupsAction = "actor.group.list"

func groupListWalk(t *testing.T) groupRoleWalk {
	t.Helper()
	w := newGroupRoleWalk(t)
	perms := map[string][]string{
		w.roles["Manager"]: {"task.read", "task.edit", "backlog.manage", "group.read"},
		w.roles["Worker"]:  {"task.read", "task.edit"},
		w.roles["Reader"]:  {"task.read"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		return perms[roleID], nil
	}
	return w
}

func TestAResidentWhoseRoleHoldsGroupReadListsTheGroupsWithNamesAndIdsOnly(t *testing.T) {
	w := groupListWalk(t)
	id, _ := w.resident(t, "Naledi", "Managers")
	w.giveRole(t, "Managers", "Manager")
	w.group(t, "Workers")

	out, err := w.deps.invokeActorTool(asPerson(id), listGroupsTool, listGroupsAction, w.instance, nil)
	if err != nil {
		t.Fatalf("a Backlog manager lists the groups: %v", err)
	}
	raw, _ := json.Marshal(out)
	var rows []map[string]any
	if err := json.Unmarshal(raw, &rows); err != nil {
		t.Fatalf("the list is not rows: %s", raw)
	}
	if len(rows) < 2 {
		t.Fatalf("a Backlog manager sees %d groups, want the hub's groups: %s", len(rows), raw)
	}
	for _, row := range rows {
		for _, leaked := range []string{"members", "emails", "assignments", "actors"} {
			if _, ok := row[leaked]; ok {
				t.Errorf("a group row carries %q: %v", leaked, row)
			}
		}
	}
}

func TestAResidentWhoseRoleLacksGroupReadIsRefusedTheGroupListWithTheSameTextAsAStranger(t *testing.T) {
	w := groupListWalk(t)
	worker, _ := w.resident(t, "Kofi", "Workers")
	w.giveRole(t, "Workers", "Worker")
	reader, _ := w.resident(t, "Amina", "Readers")
	w.giveRole(t, "Readers", "Reader")
	noRole, _ := w.resident(t, "Zuri", "Ops")

	for name, id := range map[string]string{"worker": worker, "member": reader, "group with no role": noRole, "stranger": "a-stranger"} {
		_, err := w.deps.invokeActorTool(asPerson(id), listGroupsTool, listGroupsAction, w.instance, nil)
		if !errors.Is(err, agencies.ErrInstanceNotFound) {
			t.Errorf("%s lists the groups: %v, want the instance-not-found refusal", name, err)
		}
	}
}

func TestAManagerIsNotLetThroughOtherActorCallsByHoldingGroupRead(t *testing.T) {
	w := groupListWalk(t)
	id, _ := w.resident(t, "Naledi", "Managers")
	w.giveRole(t, "Managers", "Manager")

	for _, probe := range []struct{ tool, action string }{
		{"actor_list_groups_for_actor", "actor.assignment.list_for_actor"},
		{"actor_list_actors_for_group", "actor.assignment.list_for_group"},
	} {
		_, err := w.deps.invokeActorTool(asPerson(id), probe.tool, probe.action, w.instance, nil)
		if err == nil {
			t.Errorf("a Backlog manager is let through %s", probe.tool)
		}
	}
}
