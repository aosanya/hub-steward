package http

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"wakalaserver/internal/agencies"
)

func applyUpdateWorkItem(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		WorkItemID        string `json:"work_item_id"`
		AccountableRoleID string `json:"accountable_role_id"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	if strings.TrimSpace(p.WorkItemID) == "" {
		return errors.New("name the step by work_item_id")
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
	if p.AccountableRoleID != "" {
		role, err := m.GetRole(ctx, p.AccountableRoleID)
		if err != nil {
			return err
		}
		if role.DraftID != draftID {
			return fmt.Errorf("the role %q is not in the open draft", p.AccountableRoleID)
		}
	}
	step.AccountableRoleID = p.AccountableRoleID
	if _, err = m.UpdateWorkItem(ctx, step); err != nil {
		return err
	}
	noteStep(ctx, "Set the accountable role of the step %q in the open draft", step.Title)
	return nil
}

func init() {
	approvalAppliers["agency_update_work_item"] = applyUpdateWorkItem
}
