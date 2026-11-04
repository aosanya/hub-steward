package http

import (
	"context"
	"errors"
	"fmt"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
)

const linkWorkflowObjectiveTool = "agency_link_workflow_objective"

const setMeasureTool = "agency_set_measure"

type measureEntry struct {
	Tool   string `json:"tool"`
	Name   string `json:"name"`
	Target string `json:"target"`
	Unit   string `json:"unit"`
	Status string `json:"status"`
}

type objectivePayload struct {
	titledPayload
	Workflow *struct {
		Tool       string `json:"tool"`
		WorkflowID string `json:"workflow_id"`
	} `json:"workflow"`
	Measure *measureEntry `json:"measure"`
}

func (p objectivePayload) measureToSet() *measureEntry {
	if p.Measure == nil || p.Measure.Tool != setMeasureTool {
		return nil
	}
	return p.Measure
}

func requireMeasureEntryComplete(entry *measureEntry) error {
	if entry == nil {
		return nil
	}
	if strings.TrimSpace(entry.Name) == "" {
		return errors.New("a measure has a name")
	}
	if strings.TrimSpace(entry.Target) == "" {
		return fmt.Errorf("the measure %q has a target", entry.Name)
	}
	return nil
}

func setObjectiveMeasure(ctx context.Context, m mwanachamaagency.AgencyManager, objective models.Objective, entry *measureEntry) error {
	if entry == nil {
		return nil
	}
	if _, err := m.SetMeasure(ctx, models.Measure{ObjectiveID: objective.ID, Name: entry.Name, Target: entry.Target, Unit: entry.Unit, Status: entry.Status}); err != nil {
		return err
	}
	noteStep(ctx, "Set the measure %q on the objective %q", entry.Name, objective.Title)
	return nil
}

func (p objectivePayload) workflowToLink() string {
	if p.Workflow == nil || p.Workflow.Tool != linkWorkflowObjectiveTool {
		return ""
	}
	return strings.TrimSpace(p.Workflow.WorkflowID)
}

func requireWorkflowInDraft(ctx context.Context, m mwanachamaagency.AgencyManager, draftID, workflowID string) error {
	if workflowID == "" {
		return nil
	}
	workflow, err := m.GetWorkflow(ctx, workflowID)
	if err != nil {
		return err
	}
	if workflow.DraftID != draftID {
		return fmt.Errorf("the workflow %q is not in the open draft", workflowID)
	}
	return nil
}

func linkObjectiveToWorkflow(ctx context.Context, m mwanachamaagency.AgencyManager, draftID string, objective models.Objective, workflowID string) error {
	if workflowID == "" {
		return nil
	}
	if _, err := m.CreateWorkflowObjective(ctx, models.WorkflowObjective{DraftID: draftID, WorkflowID: workflowID, ObjectiveID: objective.ID}); err != nil {
		return err
	}
	noteStep(ctx, "Linked the objective %q to the workflow", objective.Title)
	return nil
}
