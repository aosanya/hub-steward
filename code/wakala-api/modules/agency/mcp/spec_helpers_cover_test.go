package mcp

import (
	"strings"
	"testing"
)

func TestDuplicateKeyErrorNamesTheSectionAndTheKey(t *testing.T) {
	cases := []struct {
		name    string
		params  mcpDesignFromSpecParams
		section string
		key     string
	}{
		{"roles", mcpDesignFromSpecParams{Roles: []specRole{{Key: "lead"}, {Key: "lead"}}}, "roles", "lead"},
		{"goals", mcpDesignFromSpecParams{Goals: []specGoal{{Key: "g"}, {Key: "h"}, {Key: "g"}}}, "goals", "g"},
		{"objectives", mcpDesignFromSpecParams{Objectives: []specObjective{{Key: "o"}, {Key: "o"}}}, "objectives", "o"},
		{"workflows", mcpDesignFromSpecParams{Workflows: []specWorkflow{{Key: "w"}, {Key: "w"}}}, "workflows", "w"},
		{"work items", mcpDesignFromSpecParams{WorkItems: []specWorkItem{{Key: "i"}, {Key: "i"}}}, "work_items", "i"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := c.params.duplicateKeyError()
			if err == nil {
				t.Fatal("two entries with one key were accepted")
			}
			if !strings.Contains(err.Error(), c.section+" key") || !strings.Contains(err.Error(), `"`+c.key+`"`) {
				t.Fatalf("the refusal does not name the section and the key: %v", err)
			}
		})
	}
}

func TestDuplicateKeyErrorAllowsDistinctAndEmptyKeys(t *testing.T) {
	params := mcpDesignFromSpecParams{
		Roles:      []specRole{{Key: "a"}, {Key: "b"}},
		Goals:      []specGoal{{Key: ""}, {Key: ""}},
		Workflows:  []specWorkflow{{Key: "a"}},
		Objectives: []specObjective{{Key: "a"}},
	}
	if err := params.duplicateKeyError(); err != nil {
		t.Fatalf("distinct keys, the same key in different sections, and blank keys must pass: %v", err)
	}
}

func TestSpecKeysKeepsEntryOrder(t *testing.T) {
	got := specKeys([]specRole{{Key: "x"}, {Key: "y"}, {Key: "z"}}, func(r specRole) string { return r.Key })
	if strings.Join(got, ",") != "x,y,z" {
		t.Fatalf("keys came back as %v", got)
	}
	if len(specKeys([]specRole(nil), func(r specRole) string { return r.Key })) != 0 {
		t.Fatal("no entries must give no keys")
	}
}

func TestEntityCountAddsEveryEntryAndEveryWorkflowLink(t *testing.T) {
	params := mcpDesignFromSpecParams{
		Roles:      []specRole{{}, {}},
		Goals:      []specGoal{{}},
		Objectives: []specObjective{{}},
		Workflows: []specWorkflow{
			{ObjectiveKeys: []string{"a", "b"}, ObjectiveIDs: []string{"id1"}},
			{},
		},
		WorkItems: []specWorkItem{{}, {}, {}},
		RACI:      []specRACI{{}},
	}
	if got := params.entityCount(); got != 2+1+1+2+3+1+3 {
		t.Fatalf("entityCount = %d", got)
	}
	if (mcpDesignFromSpecParams{}).entityCount() != 0 {
		t.Fatal("an empty spec has no entities")
	}
}
