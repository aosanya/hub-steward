package http

import (
	"context"
	"encoding/json"
	"regexp"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
)

var textCodePattern = regexp.MustCompile(`\b(?:RU|V|W|WI|R|C|G|O|RC|RK)(?:-[A-Z]+)?-\d+\b`)

func TestEveryDemoAgencyImportsEveryStepOfEveryWorkflow(t *testing.T) {
	for _, demo := range demoAgencies(t) {
		t.Run(demo.name, func(t *testing.T) {
			demo.skipWhileItsImportIsBroken(t)
			var file struct {
				Workflows []struct {
					ID   string `json:"id"`
					Name string `json:"name"`
				} `json:"workflows"`
				WorkItems []struct {
					WorkflowID string `json:"workflow_id"`
				} `json:"work_items"`
			}
			if err := json.Unmarshal(demo.raw, &file); err != nil {
				t.Fatalf("decode: %v", err)
			}
			want := map[string]int{}
			nameOf := map[string]string{}
			for _, workflow := range file.Workflows {
				nameOf[workflow.ID] = workflow.Name
			}
			for _, item := range file.WorkItems {
				want[nameOf[item.WorkflowID]]++
			}

			walk, result := importDemoAgency(t, demo.raw)
			if result.Created["work_items"] != len(file.WorkItems) {
				t.Fatalf("created %d work items, the file holds %d", result.Created["work_items"], len(file.WorkItems))
			}

			ctx := context.Background()
			mgr, err := walk.deps.Registry.AgencyManager(ctx, result.Instance.ID)
			if err != nil {
				t.Fatalf("AgencyManager: %v", err)
			}
			workflows, err := mgr.ListWorkflows(ctx, result.DraftID, mwanachamaagency.WorkflowFilter{})
			if err != nil {
				t.Fatalf("ListWorkflows: %v", err)
			}
			steps, err := mgr.ListWorkItems(ctx, result.DraftID, mwanachamaagency.WorkItemFilter{})
			if err != nil {
				t.Fatalf("ListWorkItems: %v", err)
			}
			got := map[string]int{}
			byID := map[string]string{}
			for _, workflow := range workflows {
				byID[workflow.ID] = workflow.Name
			}
			for _, step := range steps {
				got[byID[step.WorkflowID]]++
			}
			for name, count := range want {
				if got[name] != count {
					t.Errorf("workflow %q imported %d steps, the file holds %d", name, got[name], count)
				}
			}
			if len(got) != len(want) {
				t.Errorf("imported %d workflows with steps, the file holds %d", len(got), len(want))
			}
		})
	}
}

func TestAnImportedDemoAgencyKeepsTheCodesItsFileGives(t *testing.T) {
	for _, demo := range demoAgencies(t) {
		t.Run(demo.name, func(t *testing.T) {
			demo.skipWhileItsImportIsBroken(t)
			var file codedFile
			if err := json.Unmarshal(demo.raw, &file); err != nil {
				t.Fatalf("decode: %v", err)
			}
			walk, result := importDemoAgency(t, demo.raw)
			ctx := context.Background()
			mgr, err := walk.deps.Registry.AgencyManager(ctx, result.Instance.ID)
			if err != nil {
				t.Fatalf("AgencyManager: %v", err)
			}
			live := map[string]string{}
			workflows, err := mgr.ListWorkflows(ctx, result.DraftID, mwanachamaagency.WorkflowFilter{})
			if err != nil {
				t.Fatalf("ListWorkflows: %v", err)
			}
			for _, w := range workflows {
				live[w.Code] = w.Name
			}
			for _, w := range file.Workflows {
				if w.Code != "" && live[w.Code] != w.Name {
					t.Errorf("workflow %q is %q after import, the file gives it %q", w.Code, live[w.Code], w.Name)
				}
			}
			controls, err := mgr.ListControls(ctx, result.DraftID, mwanachamaagency.ControlFilter{})
			if err != nil {
				t.Fatalf("ListControls: %v", err)
			}
			controlCodes := map[string]bool{}
			for _, c := range controls {
				controlCodes[c.Code] = true
			}
			for _, c := range append(append([]codedName(nil), file.Values...), file.Rules...) {
				if c.Code != "" && !controlCodes[c.Code] {
					t.Errorf("control %q is missing after import", c.Code)
				}
			}
		})
	}
}

func TestNoTextOfAnImportedDemoAgencyNamesACodeThatDoesNotExist(t *testing.T) {
	for _, demo := range demoAgencies(t) {
		t.Run(demo.name, func(t *testing.T) {
			demo.skipWhileItsImportIsBroken(t)
			walk, result := importDemoAgency(t, demo.raw)
			ctx := context.Background()
			mgr, err := walk.deps.Registry.AgencyManager(ctx, result.Instance.ID)
			if err != nil {
				t.Fatalf("AgencyManager: %v", err)
			}
			held := map[string]bool{}
			var texts []string
			roles, _ := mgr.ListRoles(ctx, result.DraftID, mwanachamaagency.RoleFilter{})
			for _, r := range roles {
				held[r.Code] = true
				texts = append(texts, r.Description)
			}
			goals, _ := mgr.ListGoals(ctx, result.DraftID, mwanachamaagency.GoalFilter{})
			for _, g := range goals {
				held[g.Code] = true
				texts = append(texts, g.Description)
			}
			objectives, _ := mgr.ListObjectives(ctx, result.DraftID, mwanachamaagency.ObjectiveFilter{})
			for _, o := range objectives {
				held[o.Code] = true
				texts = append(texts, o.Description)
			}
			workflows, _ := mgr.ListWorkflows(ctx, result.DraftID, mwanachamaagency.WorkflowFilter{})
			for _, w := range workflows {
				held[w.Code] = true
				texts = append(texts, w.Description)
			}
			steps, _ := mgr.ListWorkItems(ctx, result.DraftID, mwanachamaagency.WorkItemFilter{})
			for _, s := range steps {
				held[s.Code] = true
				texts = append(texts, s.Description, s.Prompt)
			}
			controls, _ := mgr.ListControls(ctx, result.DraftID, mwanachamaagency.ControlFilter{})
			for _, c := range controls {
				held[c.Code] = true
				texts = append(texts, c.Text)
			}
			for _, text := range texts {
				for _, code := range textCodePattern.FindAllString(text, -1) {
					if !held[code] {
						t.Errorf("a text names %q, which no row of the imported agency carries", code)
					}
				}
			}
		})
	}
}
