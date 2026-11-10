package http

import (
	"strings"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
)

func (w applyWorld) workflowInOpenDraft(t *testing.T, name string) models.Workflow {
	t.Helper()
	m := w.agency(t)
	workflow, err := m.CreateWorkflow(w.ctx, models.Workflow{DraftID: openDraftID(t, w), Name: name})
	if err != nil {
		t.Fatalf("CreateWorkflow: %v", err)
	}
	return workflow
}

func TestApprovedObjectiveCanLinkAWorkflowAndCarryAMeasure(t *testing.T) {
	w := newApplyWorld(t)
	workflow := w.workflowInOpenDraft(t, "Register a birth")
	payload := map[string]any{
		"title":    "Birth registered within a day",
		"workflow": map[string]any{"tool": "agency_link_workflow_objective", "workflow_id": workflow.ID},
		"measure":  map[string]any{"tool": "agency_set_measure", "name": "Days to register", "target": "1", "unit": "days"},
	}
	done, err := w.approved(t, "agency_create_objective", payload)
	if err != nil {
		t.Fatalf("approved objective: %v", err)
	}
	for _, step := range []string{"Created the objective", "Linked the objective", "Set the measure"} {
		if !strings.Contains(done.Applied, step) {
			t.Fatalf("the approval must record %q, got %q", step, done.Applied)
		}
	}
	m := w.agency(t)
	draft := openDraftID(t, w)
	links, err := m.ListWorkflowObjectives(w.ctx, draft, mwanachamaagency.WorkflowObjectiveFilter{})
	if err != nil || len(links) != 1 || links[0].WorkflowID != workflow.ID {
		t.Fatalf("the objective must be linked to the workflow, got %v %v", links, err)
	}
	measures, err := m.ListMeasures(w.ctx, draft, mwanachamaagency.MeasureFilter{})
	if err != nil || len(measures) != 1 || measures[0].Name != "Days to register" || measures[0].Target != "1" {
		t.Fatalf("the objective must carry its measure, got %v %v", measures, err)
	}
}

func TestApprovedObjectiveIsRefusedBeforeAnythingIsMadeWhenItsWorkflowOrMeasureIsWrong(t *testing.T) {
	w := newApplyWorld(t)
	w.workflowInOpenDraft(t, "Register a birth")
	m := w.agency(t)
	if err := w.apply("agency_create_objective", map[string]any{
		"title":   "No target",
		"measure": map[string]any{"tool": "agency_set_measure", "name": "Days"},
	}); err == nil || !strings.Contains(err.Error(), "has a target") {
		t.Fatalf("a measure with no target must be refused, got %v", err)
	}
	if err := w.apply("agency_create_objective", map[string]any{
		"title":   "No name",
		"measure": map[string]any{"tool": "agency_set_measure", "target": "3"},
	}); err == nil || !strings.Contains(err.Error(), "has a name") {
		t.Fatalf("a measure with no name must be refused, got %v", err)
	}
	objectives, _ := m.ListObjectives(w.ctx, openDraftID(t, w), mwanachamaagency.ObjectiveFilter{})
	if len(objectives) != 0 {
		t.Fatalf("a refused proposal must leave no objective behind, got %v", objectives)
	}
}

func TestApprovedMeasureIsSetOnAnObjectiveOfTheOpenDraftOnly(t *testing.T) {
	w := newApplyWorld(t)
	if err := w.apply("agency_create_objective", map[string]any{"title": "Faster queues"}); err != nil {
		t.Fatalf("create objective: %v", err)
	}
	m := w.agency(t)
	objectives, _ := m.ListObjectives(w.ctx, openDraftID(t, w), mwanachamaagency.ObjectiveFilter{})
	id := objectives[0].ID

	if err := w.apply("agency_set_measure", map[string]any{"name": "Wait", "target": "5"}); err == nil || !strings.Contains(err.Error(), "objective_id") {
		t.Fatalf("a measure that names no objective must say so, got %v", err)
	}
	if err := w.apply("agency_set_measure", map[string]any{"objective_id": id, "name": "Wait", "target": "5", "unit": "minutes"}); err != nil {
		t.Fatalf("set measure: %v", err)
	}
	measures, _ := m.ListMeasures(w.ctx, openDraftID(t, w), mwanachamaagency.MeasureFilter{})
	if len(measures) != 1 || measures[0].Unit != "minutes" {
		t.Fatalf("the measure must be stored with its unit, got %v", measures)
	}
}

func TestApprovedWorkflowLinkIsMadeAndUnmadeByName(t *testing.T) {
	w := newApplyWorld(t)
	workflow := w.workflowInOpenDraft(t, "Register a birth")
	if err := w.apply("agency_create_objective", map[string]any{"title": "Faster"}); err != nil {
		t.Fatalf("create objective: %v", err)
	}
	m := w.agency(t)
	draft := openDraftID(t, w)
	objectives, _ := m.ListObjectives(w.ctx, draft, mwanachamaagency.ObjectiveFilter{})
	objective := objectives[0].ID

	for _, bad := range []map[string]any{{"objective_id": objective}, {"workflow_id": workflow.ID}} {
		if err := w.apply("agency_link_workflow_objective", bad); err == nil {
			t.Fatalf("a link missing its workflow or objective must be refused: %v", bad)
		}
	}
	done, err := w.approved(t, "agency_link_workflow_objective", map[string]any{"workflow_id": workflow.ID, "objective_id": objective})
	if err != nil || !strings.Contains(done.Applied, "Linked the objective") {
		t.Fatalf("link: %v %+v", err, done)
	}
	links, _ := m.ListWorkflowObjectives(w.ctx, draft, mwanachamaagency.WorkflowObjectiveFilter{})
	if len(links) != 1 {
		t.Fatalf("one link expected, got %v", links)
	}
	if err := w.apply("agency_delete_workflow_objective", map[string]any{}); err == nil || !strings.Contains(err.Error(), "workflow_objective_id") {
		t.Fatalf("an unlink that names no link must say so, got %v", err)
	}
	done, err = w.approved(t, "agency_delete_workflow_objective", map[string]any{"workflow_objective_id": links[0].ID})
	if err != nil || !strings.Contains(done.Applied, "Unlinked") {
		t.Fatalf("unlink: %v %+v", err, done)
	}
	if left, _ := m.ListWorkflowObjectives(w.ctx, draft, mwanachamaagency.WorkflowObjectiveFilter{}); len(left) != 0 {
		t.Fatalf("the link must be gone, got %v", left)
	}
}

func TestApprovedWorkflowDeleteNeedsAnIdAndRemovesTheWorkflow(t *testing.T) {
	w := newApplyWorld(t)
	workflow := w.workflowInOpenDraft(t, "Register a birth")
	if err := w.apply("agency_delete_workflow", map[string]any{"workflow_id": "  "}); err == nil || !strings.Contains(err.Error(), "workflow_id") {
		t.Fatalf("a delete that names no workflow must say so, got %v", err)
	}
	if err := w.apply("agency_delete_workflow", map[string]any{"workflow_id": workflow.ID}); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := w.agency(t).GetWorkflow(w.ctx, workflow.ID); err == nil {
		t.Fatal("the deleted workflow must be gone")
	}
}
