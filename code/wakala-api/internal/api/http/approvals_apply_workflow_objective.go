package http

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"wakalaserver/internal/agencies"
)

func applyLinkWorkflowObjective(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		WorkflowID  string `json:"workflow_id"`
		ObjectiveID string `json:"objective_id"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	if strings.TrimSpace(p.WorkflowID) == "" {
		return errors.New("name the workflow by workflow_id")
	}
	if strings.TrimSpace(p.ObjectiveID) == "" {
		return errors.New("name the objective by objective_id")
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	draftID, err := workingDraftID(ctx, m)
	if err != nil {
		return err
	}
	if err = requireWorkflowInDraft(ctx, m, draftID, p.WorkflowID); err != nil {
		return err
	}
	objective, err := m.GetObjective(ctx, p.ObjectiveID)
	if err != nil {
		return err
	}
	if objective.DraftID != draftID {
		return fmt.Errorf("the objective %q is not in the open draft", p.ObjectiveID)
	}
	return linkObjectiveToWorkflow(ctx, m, draftID, objective, p.WorkflowID)
}

func applyDeleteWorkflowObjective(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		WorkflowObjectiveID string `json:"workflow_objective_id"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	if strings.TrimSpace(p.WorkflowObjectiveID) == "" {
		return errors.New("name the link by workflow_objective_id")
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	draftID, err := workingDraftID(ctx, m)
	if err != nil {
		return err
	}
	link, err := m.GetWorkflowObjective(ctx, p.WorkflowObjectiveID)
	if err != nil {
		return err
	}
	if link.DraftID != draftID {
		return fmt.Errorf("the link %q is not in the open draft", p.WorkflowObjectiveID)
	}
	if err = m.DeleteWorkflowObjective(ctx, p.WorkflowObjectiveID); err != nil {
		return err
	}
	noteStep(ctx, "Unlinked the objective from the workflow in the open draft")
	return nil
}

func init() {
	approvalAppliers["agency_link_workflow_objective"] = applyLinkWorkflowObjective
	approvalAppliers["agency_delete_workflow_objective"] = applyDeleteWorkflowObjective
}
