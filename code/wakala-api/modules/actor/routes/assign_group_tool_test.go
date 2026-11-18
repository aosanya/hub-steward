package routes_test

import (
	"context"
	"encoding/json"
	"slices"
	"testing"

	actor "wakalaserver/modules/actor"
	"wakalaserver/modules/actor/routes"
)

func assignGroupTool(t *testing.T, um actor.UserManager) routes.Tool {
	t.Helper()
	tools, err := routes.BuildToolsFor(um, routes.Mount{})
	if err != nil {
		t.Fatalf("BuildTools: %v", err)
	}
	for _, tool := range tools {
		if tool.Name == "actor_assign_group" {
			return tool
		}
	}
	t.Fatal("no actor_assign_group tool")
	return routes.Tool{}
}

func TestAssignGroupToolNamesTheGroupItRegistersTheActorIn(t *testing.T) {
	um := managerOnMemory(t)
	tool := assignGroupTool(t, um)
	var schema struct {
		Properties map[string]map[string]any `json:"properties"`
		Required   []string                  `json:"required"`
	}
	if err := json.Unmarshal(tool.InputSchema, &schema); err != nil {
		t.Fatal(err)
	}
	if _, declared := schema.Properties["group_id"]; !declared || !slices.Contains(schema.Required, "group_id") {
		t.Fatalf("group_id is not a required argument: %v required %v", schema.Properties, schema.Required)
	}

	person, err := um.CreateActor(context.Background(), actor.Actor{DisplayName: "Kovács Anna"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	group, err := um.CreateGroup(context.Background(), actor.Group{Name: "Kertváros körzet"})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	raw, _ := json.Marshal(map[string]any{"actor_id": person.ID, "group_id": group.ID})
	if _, err := tool.Invoke(context.Background(), raw); err != nil {
		t.Fatalf("registering through the tool: %v", err)
	}
	held, err := um.ListGroupsForActor(context.Background(), person.ID)
	if err != nil || len(held) != 1 || held[0].GroupID != group.ID {
		t.Fatalf("groups of the person = %+v (%v), want the one registered", held, err)
	}
}
