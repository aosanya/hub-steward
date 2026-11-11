package http

import (
	"net/http"
	"strings"
	"testing"
)

type namedRoute struct {
	label  string
	method string
	path   string
	field  string
	extra  map[string]any
	word   string
}

func (n namedRoute) body(name string) map[string]any {
	out := map[string]any{n.field: name}
	for k, v := range n.extra {
		out[k] = v
	}
	return out
}

func namesThatDrawNothing() []string {
	return []string{"ㅤ", "⠀", "ᅟ", "ㅤㅤㅤ", "AnnaㅤPolgármester"}
}

func (w stepRunWalk) createdID(t *testing.T, path string, body map[string]any) string {
	t.Helper()
	rec := w.call(t, "POST", path, body, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST %s %v: %d %s", path, body, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	if id == "" {
		t.Fatalf("POST %s: no id in %s", path, rec.Body.String())
	}
	return id
}

func (w stepRunWalk) refuseNames(t *testing.T, route namedRoute) {
	t.Helper()
	for _, name := range namesThatDrawNothing() {
		rec := w.call(t, route.method, route.path, route.body(name), w.owner)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s with %q: %d %s, want 400", route.label, name, rec.Code, rec.Body.String())
		}
		if !strings.Contains(rec.Body.String(), route.word) {
			t.Fatalf("%s with %q: %s, want the message to name %q", route.label, name, rec.Body.String(), route.word)
		}
	}
}

func (w stepRunWalk) admitNames(t *testing.T, route namedRoute) {
	t.Helper()
	for _, name := range []string{"Kovács Anna", "Őze Ödön", "Kóvács", "Anna-Mária O'Neil", "Szűcs"} {
		rec := w.call(t, route.method, route.path, route.body(name), w.owner)
		if rec.Code >= 300 {
			t.Fatalf("%s with %q: %d %s, want it accepted", route.label, name, rec.Code, rec.Body.String())
		}
	}
}

func TestActorNames_OwnerCannotDoNameAnActorWithCharactersThatDrawNothing(t *testing.T) {
	w := newStepRunWalk(t, nil)
	actors := "/instances/" + w.instance + "/actor/actors"
	actorID := w.createdID(t, actors, map[string]any{"display_name": "Kovács Anna"})

	create := namedRoute{label: "create actor", method: "POST", path: actors, field: "display_name", word: "display name"}
	rename := namedRoute{label: "rename actor", method: "PATCH", path: actors + "/" + actorID + "/display-name", field: "display_name", word: "display name"}
	w.refuseNames(t, create)
	w.refuseNames(t, rename)
	w.refuseNames(t, namedRoute{label: "create actor first name", method: "POST", path: actors, field: "first_name", word: "first name"})
	w.refuseNames(t, namedRoute{label: "create actor last name", method: "POST", path: actors, field: "last_name", word: "last name"})
	w.admitNames(t, rename)
}

func TestHierarchyNames_OwnerCannotDoNameAHierarchyOrLevelWithCharactersThatDrawNothing(t *testing.T) {
	w := newStepRunWalk(t, nil)
	base := "/instances/" + w.instance + "/actor"
	hierarchyID := w.createdID(t, base+"/hierarchies", map[string]any{"name": "Municipal"})
	levelID := w.createdID(t, base+"/levels", map[string]any{"hierarchy_id": hierarchyID, "name": "Ward", "depth": 1})

	w.refuseNames(t, namedRoute{label: "create hierarchy", method: "POST", path: base + "/hierarchies", field: "name", word: "hierarchy name"})
	w.refuseNames(t, namedRoute{label: "rename hierarchy", method: "PATCH", path: base + "/hierarchies/" + hierarchyID, field: "name", word: "hierarchy name"})
	w.refuseNames(t, namedRoute{label: "create level", method: "POST", path: base + "/levels", field: "name", extra: map[string]any{"hierarchy_id": hierarchyID, "depth": 2}, word: "level name"})
	w.refuseNames(t, namedRoute{label: "rename level", method: "PATCH", path: base + "/levels/" + levelID, field: "name", word: "level name"})
	w.admitNames(t, namedRoute{label: "rename hierarchy", method: "PATCH", path: base + "/hierarchies/" + hierarchyID, field: "name"})
	w.admitNames(t, namedRoute{label: "rename level", method: "PATCH", path: base + "/levels/" + levelID, field: "name"})
}

func TestGroupTypeNames_OwnerCannotDoNameAGroupTypeWithCharactersThatDrawNothing(t *testing.T) {
	w := newStepRunWalk(t, nil)
	base := "/instances/" + w.instance + "/actor"
	hierarchyID := w.createdID(t, base+"/hierarchies", map[string]any{"name": "Municipal"})
	typeID := w.createdID(t, base+"/group-types", map[string]any{"hierarchy_id": hierarchyID, "name": "Ward"})
	hierarchy := map[string]any{"hierarchy_id": hierarchyID}

	w.refuseNames(t, namedRoute{label: "create group type", method: "POST", path: base + "/group-types", field: "name", extra: hierarchy, word: "group type name"})
	w.refuseNames(t, namedRoute{label: "create group type singular", method: "POST", path: base + "/group-types", field: "singular", extra: map[string]any{"hierarchy_id": hierarchyID, "name": "Street"}, word: "singular"})
	w.refuseNames(t, namedRoute{label: "create group type plural", method: "POST", path: base + "/group-types", field: "plural", extra: map[string]any{"hierarchy_id": hierarchyID, "name": "Street"}, word: "plural"})
	w.refuseNames(t, namedRoute{label: "edit group type", method: "PATCH", path: base + "/group-types/" + typeID, field: "name", word: "group type name"})
	w.refuseNames(t, namedRoute{label: "edit group type plural", method: "PATCH", path: base + "/group-types/" + typeID, field: "plural", extra: map[string]any{"name": "Ward"}, word: "plural"})
	w.admitNames(t, namedRoute{label: "edit group type", method: "PATCH", path: base + "/group-types/" + typeID, field: "name"})
}

func TestRoleKindNames_OwnerCannotDoNameARoleKindWithCharactersThatDrawNothing(t *testing.T) {
	w := newStepRunWalk(t, nil)
	base := "/instances/" + w.instance + "/actor"

	w.refuseNames(t, namedRoute{label: "create role kind", method: "POST", path: base + "/role-kinds", field: "name", word: "role kind name"})
	w.admitNames(t, namedRoute{label: "create role kind", method: "POST", path: base + "/role-kinds", field: "name"})
}

func TestGroupNameTranslations_OwnerCannotDoTranslateAGroupNameToCharactersThatDrawNothing(t *testing.T) {
	w := newStepRunWalk(t, nil)
	base := "/instances/" + w.instance + "/actor"
	groupID := w.createdID(t, base+"/groups", map[string]any{"name": "Kertváros körzet"})
	translation := base + "/groups/" + groupID + "/names/hu"

	w.refuseNames(t, namedRoute{label: "translate group name", method: "PUT", path: translation, field: "name", word: "translated group name"})
	w.admitNames(t, namedRoute{label: "translate group name", method: "PUT", path: translation, field: "name"})
}

func TestAgencyName_OwnerCannotDoNameTheAgencyWithCharactersThatDrawNothing(t *testing.T) {
	w := newStepRunWalk(t, nil)
	name := "/instances/" + w.instance + "/name"

	w.refuseNames(t, namedRoute{label: "rename agency", method: "PUT", path: name, field: "name", word: "a name is"})
	w.admitNames(t, namedRoute{label: "rename agency", method: "PUT", path: name, field: "name"})
	for _, drawn := range namesThatDrawNothing() {
		rec := w.call(t, "POST", "/instances", map[string]any{"name": drawn}, w.owner)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("create agency named %q: %d %s, want 400", drawn, rec.Code, rec.Body.String())
		}
	}
}

func TestAgencyName_OwnerCannotDoRenameTheAgencyThroughMCPToCharactersThatDrawNothing(t *testing.T) {
	w := newDesignAgentWalk(t)
	for _, name := range namesThatDrawNothing() {
		if out := w.mcpCall(t, "test-owner", "instance_rename", map[string]any{"instance_id": w.instance, "name": name}); !out.IsError {
			t.Errorf("owner renaming the agency to %q through MCP: succeeded, want a tool error", name)
		}
	}
}

func TestActorNames_OwnerCannotDoNameAnActorThroughMCPWithCharactersThatDrawNothing(t *testing.T) {
	w := newDesignAgentWalk(t)
	created := w.mcpCall(t, "test-owner", "actor_create_actor", map[string]any{"instance_id": w.instance, "display_name": "Kovács Anna"})
	if created.IsError {
		t.Fatalf("create actor through MCP: %s", toolErrorText(created))
	}
	for _, name := range namesThatDrawNothing() {
		if out := w.mcpCall(t, "test-owner", "actor_create_actor", map[string]any{"instance_id": w.instance, "display_name": name}); !out.IsError {
			t.Errorf("creating an actor named %q through MCP: succeeded, want a tool error", name)
		}
	}
}

func TestBacklogNames_OwnerCannotDoNameABacklogOrStepWithCharactersThatDrawNothing(t *testing.T) {
	w := newStepRunWalk(t, nil)
	tm := "/instances/" + w.instance + "/taskmanager"
	rec := w.call(t, "POST", tm+"/backlogs", map[string]any{"name": "Roads", "steps": []string{"To do", "Done"}}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create backlog: %d %s", rec.Code, rec.Body.String())
	}
	backlogID, _ := decodeObject(t, rec)["id"].(string)
	stepID := "to-do"

	w.refuseNames(t, namedRoute{label: "create backlog", method: "POST", path: tm + "/backlogs", field: "name", extra: map[string]any{"steps": []string{"Open"}}, word: "backlog name"})
	for _, name := range namesThatDrawNothing() {
		rec := w.call(t, "POST", tm+"/backlogs", map[string]any{"name": "Water", "steps": []string{"Open", name}}, w.owner)
		if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "step name") {
			t.Fatalf("create backlog with a step named %q: %d %s, want 400 naming the step name", name, rec.Code, rec.Body.String())
		}
	}
	w.refuseNames(t, namedRoute{label: "rename backlog", method: "PUT", path: tm + "/backlogs/" + backlogID, field: "name", word: "backlog name"})
	w.refuseNames(t, namedRoute{label: "add step", method: "POST", path: tm + "/backlogs/" + backlogID + "/steps", field: "name", word: "step name"})
	w.refuseNames(t, namedRoute{label: "rename step", method: "PUT", path: tm + "/backlogs/" + backlogID + "/steps/" + stepID, field: "name", word: "step name"})
	w.admitNames(t, namedRoute{label: "rename backlog", method: "PUT", path: tm + "/backlogs/" + backlogID, field: "name"})
	w.admitNames(t, namedRoute{label: "rename step", method: "PUT", path: tm + "/backlogs/" + backlogID + "/steps/" + stepID, field: "name"})
}

func TestScenarioActorNames_OwnerCannotDoNameAScenarioActorWithCharactersThatDrawNothing(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Liaison")
	base := "/instances/" + w.instance
	scenarioID := w.createdID(t, base+"/scenarios", map[string]any{"draft_id": w.draftID, "name": "Referral arrives", "workflow_id": w.workflow})
	actors := base + "/scenarios/" + scenarioID + "/actors"
	role := map[string]any{"role_id": w.roles["Liaison"]}

	w.refuseNames(t, namedRoute{label: "add scenario actor", method: "POST", path: actors, field: "name", extra: role, word: "scenario actor name"})
	actorID := w.createdID(t, actors, map[string]any{"name": "Anna", "role_id": w.roles["Liaison"]})
	w.refuseNames(t, namedRoute{label: "rename scenario actor", method: "PATCH", path: actors + "/" + actorID, field: "name", word: "scenario actor name"})
	w.admitNames(t, namedRoute{label: "rename scenario actor", method: "PATCH", path: actors + "/" + actorID, field: "name"})
}
