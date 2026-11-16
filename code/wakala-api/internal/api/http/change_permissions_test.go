package http

import (
	"context"
	"net/http"
	"strings"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

type changeTarget struct {
	designAgentWalk
	personID   string
	locationID string
	volunteer  string
}

func newChangeTarget(t *testing.T) changeTarget {
	t.Helper()
	w := changeTarget{designAgentWalk: newDesignAgentWalk(t)}
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	person, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Old Name"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	w.personID = person.ID
	actors, err := um.ListActors(ctx)
	if err != nil {
		t.Fatalf("ListActors: %v", err)
	}
	for _, a := range actors {
		if a.DisplayName == "Volunteer" {
			w.volunteer = a.ID
		}
	}
	rec := w.call(t, "POST", w.base+"/assetmanager/locations", map[string]any{"code": "hall", "name": "Hall"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("owner creates a place: %d %s", rec.Code, rec.Body.String())
	}
	w.locationID, _ = decodeObject(t, rec)["id"].(string)
	return w
}

func (w changeTarget) seatThroughAGroupRole(t *testing.T) {
	t.Helper()
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	group, err := um.CreateGroup(ctx, mwanachamaactor.Group{Name: "Front desk"})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: w.volunteer, GroupID: group.ID}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}
	holder, ok := w.deps.Registry.(agencies.GroupRoles)
	if !ok {
		t.Fatal("the registry does not hold group roles")
	}
	if err := holder.GiveGroupRole(ctx, w.instance, group.ID, w.roleID); err != nil {
		t.Fatalf("GiveGroupRole: %v", err)
	}
}

type changeCall struct {
	tool string
	code string
	args func(w changeTarget) map[string]any
}

var changeCalls = []changeCall{
	{"actor_set_actor_display_name", "member.edit", func(w changeTarget) map[string]any {
		return map[string]any{"instance_id": w.instance, "actor_id": w.personID, "display_name": "New Name"}
	}},
	{"actor_set_actor_attributes", "member.edit", func(w changeTarget) map[string]any {
		return map[string]any{"instance_id": w.instance, "actor_id": w.personID, "attributes": map[string]any{"phone": "+3611111111"}}
	}},
	{"assetmanager_location_update", "location.edit", func(w changeTarget) map[string]any {
		return map[string]any{"instance_id": w.instance, "locationID": w.locationID, "name": "Great Hall"}
	}},
}

func TestChangeCodes_OwnerChangesAPersonAndAPlace(t *testing.T) {
	w := newChangeTarget(t)
	for _, c := range changeCalls {
		if out := w.mcpCall(t, "test-owner", c.tool, c.args(w)); out.IsError {
			t.Errorf("owner calling %s: %s", c.tool, toolErrorText(out))
		}
	}
}

func TestChangeCodes_AgentWithoutTheCodeIsRefusedAndTheRefusalNamesIt(t *testing.T) {
	w := newChangeTarget(t)
	for _, c := range changeCalls {
		out := w.mcpCall(t, "agent-chat", c.tool, c.args(w))
		if !out.IsError {
			t.Errorf("an agent without %s called %s, want a refusal", c.code, c.tool)
			continue
		}
		if !strings.Contains(toolErrorText(out), c.code) {
			t.Errorf("%s refusal %q does not name %s", c.tool, toolErrorText(out), c.code)
		}
	}
}

func TestChangeCodes_AgentHoldingTheCodeChanges(t *testing.T) {
	for _, c := range changeCalls {
		w := newChangeTarget(t)
		givesTheRole(t, w.designAgentWalk, c.code)
		if out := w.mcpCall(t, "agent-chat", c.tool, c.args(w)); out.IsError {
			t.Errorf("an agent holding %s calling %s: %s", c.code, c.tool, toolErrorText(out))
		}
	}
}

func TestChangeCodes_AgentHoldingTheOtherCodeIsStillRefused(t *testing.T) {
	for _, c := range changeCalls {
		w := newChangeTarget(t)
		other := "member.edit"
		if c.code == other {
			other = "location.edit"
		}
		givesTheRole(t, w.designAgentWalk, other)
		if out := w.mcpCall(t, "agent-chat", c.tool, c.args(w)); !out.IsError {
			t.Errorf("an agent holding only %s called %s, want a refusal", other, c.tool)
		}
	}
}

func TestChangeCodes_ResidentWithoutTheCodeIsRefusedAndTheRefusalNamesIt(t *testing.T) {
	w := newChangeTarget(t)
	for _, c := range changeCalls {
		out := w.mcpCall(t, w.volunteer, c.tool, c.args(w))
		if !out.IsError {
			t.Errorf("a resident without %s called %s, want a refusal", c.code, c.tool)
			continue
		}
		if !strings.Contains(toolErrorText(out), c.code) {
			t.Errorf("%s refusal %q does not name %s", c.tool, toolErrorText(out), c.code)
		}
	}
}

func TestChangeCodes_ResidentHoldingTheCodeThroughARoleChanges(t *testing.T) {
	for _, c := range changeCalls {
		w := newChangeTarget(t)
		held := map[string][]string{w.roles["Volunteer"]: {c.code}}
		w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
			return held[roleID], nil
		}
		w.seatThroughAGroupRole(t)
		if out := w.mcpCall(t, w.volunteer, c.tool, c.args(w)); out.IsError {
			t.Errorf("a resident holding %s calling %s: %s", c.code, c.tool, toolErrorText(out))
		}
	}
}
