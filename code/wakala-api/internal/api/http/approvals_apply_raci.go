package http

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"wakalaserver/internal/agencies"
	"wakalaserver/modules/agency/models"
)

func applySetRaci(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		WorkItemID string `json:"work_item_id"`
		RoleID     string `json:"role_id"`
		Label      string `json:"label"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	if strings.TrimSpace(p.WorkItemID) == "" {
		return errors.New("name the step by work_item_id")
	}
	if strings.TrimSpace(p.RoleID) == "" {
		return errors.New("name the role by role_id")
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	draftID, err := workingDraftID(ctx, m)
	if err != nil {
		return err
	}
	step, err := m.GetWorkItem(ctx, p.WorkItemID)
	if err != nil {
		return err
	}
	if step.DraftID != draftID {
		return fmt.Errorf("the step %q is not in the open draft", p.WorkItemID)
	}
	role, err := m.GetRole(ctx, p.RoleID)
	if err != nil {
		return err
	}
	if role.DraftID != draftID {
		return fmt.Errorf("the role %q is not in the open draft", p.RoleID)
	}
	if _, err = m.CreateRoleAssignment(ctx, models.RoleAssignment{DraftID: draftID, WorkItemID: p.WorkItemID, RoleID: p.RoleID, Label: models.RACILabel(p.Label)}); err != nil {
		return err
	}
	noteStep(ctx, "Put the role %q on the step %q as %s in the open draft", role.Name, step.Title, p.Label)
	return nil
}

func applyDeleteRoleAssignment(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		AssignmentID string `json:"assignment_id"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	if strings.TrimSpace(p.AssignmentID) == "" {
		return errors.New("name the assignment by assignment_id")
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	draftID, err := workingDraftID(ctx, m)
	if err != nil {
		return err
	}
	assignment, err := m.GetRoleAssignment(ctx, p.AssignmentID)
	if err != nil {
		return err
	}
	if assignment.DraftID != draftID {
		return fmt.Errorf("the assignment %q is not in the open draft", p.AssignmentID)
	}
	if err = m.DeleteRoleAssignment(ctx, p.AssignmentID); err != nil {
		return err
	}
	noteStep(ctx, "Took the role off the step as %s in the open draft", assignment.Label)
	return nil
}

func init() {
	approvalAppliers["agency_set_raci"] = applySetRaci
	approvalAppliers["agency_delete_role_assignment"] = applyDeleteRoleAssignment
}
