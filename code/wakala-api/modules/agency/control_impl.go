package mwanachamaagency

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

type ControlFilter struct {
	Code   string `query:"code"`
	Text   string `query:"text"`
	Action string `query:"action"`
}

func (m *agencyManager) validControl(ctx context.Context, tx *gorm.DB, c models.Control, draftID string) error {
	invalid := func(format string, args ...any) error {
		return fmt.Errorf("%w: "+format, append([]any{ErrInvalidControl}, args...)...)
	}
	if strings.TrimSpace(c.Text) == "" {
		return invalid("Control.Text is required")
	}
	if (c.Action == "") != (c.OnBreach == "") {
		return invalid("action and on_breach are set together or not at all")
	}
	conditionParts := 0
	for _, part := range []string{c.CondField, string(c.CondOperator), c.CondValue} {
		if part != "" {
			conditionParts++
		}
	}
	if conditionParts != 0 && conditionParts != 3 {
		return invalid("a condition needs a field, an operator and a value")
	}
	if conditionParts == 3 && c.Action == "" {
		return invalid("a condition needs an action to guard")
	}
	if c.CondOperator != "" && !c.CondOperator.Valid() {
		return invalid("unknown operator %q", c.CondOperator)
	}
	if c.OnBreach != "" && !c.OnBreach.Valid() {
		return invalid("unknown on_breach %q", c.OnBreach)
	}
	if c.Severity != "" && !c.Severity.Valid() {
		return invalid("unknown severity %q", c.Severity)
	}
	if c.OnBreach != models.OnBreachRunWorkflow {
		if c.WorkflowID != "" {
			return invalid("workflow_id is only for the run_workflow outcome")
		}
		return nil
	}
	if c.WorkflowID == "" {
		return invalid("run_workflow needs a workflow_id")
	}
	wf, err := m.findWorkflow(ctx, tx, c.WorkflowID)
	if err != nil || wf.DraftID != draftID {
		return fmt.Errorf("%w: workflow %s is not in this draft", ErrInvalidControl, c.WorkflowID)
	}
	return nil
}

func (m *agencyManager) CreateControl(ctx context.Context, c models.Control) (models.Control, error) {
	if err := m.validateOpenDraftID(ctx, c.DraftID); err != nil {
		return models.Control{}, err
	}
	if err := m.validControl(ctx, m.db, c, c.DraftID); err != nil {
		return models.Control{}, err
	}
	c.ID = newID()
	c.Deleted = false
	c.CreatedAt = models.NowRFC3339()
	c.LastUpdated = c.CreatedAt

	err := m.createWithCode(ctx, roleControl, "control", "C", func(code string) any {
		c.Code = code
		return c
	})
	if err != nil {
		return models.Control{}, fmt.Errorf("CreateControl: %w", err)
	}
	return c, nil
}

func (m *agencyManager) GetControl(ctx context.Context, id string) (models.Control, error) {
	return m.findControl(ctx, m.db, id)
}

func (m *agencyManager) ListControls(ctx context.Context, draftID string, filter ControlFilter) ([]models.Control, error) {
	q := scopeQuery(m.q(ctx, roleControl).Order("created_at"), draftID)
	q = likeFilter(q, "code", filter.Code)
	q = likeFilter(q, "text", filter.Text)
	q = eqFilter(q, "action", filter.Action)

	out, err := list[models.Control](m, q, roleControl)
	if err != nil {
		return nil, fmt.Errorf("ListControls: %w", err)
	}
	return out, nil
}

func (m *agencyManager) UpdateControl(ctx context.Context, c models.Control) (models.Control, error) {
	var out models.Control
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findControl(ctx, tx, c.ID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		if err := m.validControl(ctx, tx, c, existing.DraftID); err != nil {
			return err
		}
		c.Code = existing.Code
		c.DraftID = existing.DraftID
		c.CreatedAt = existing.CreatedAt
		c.LastUpdated = models.NowRFC3339()

		if err := m.writeUpdate(ctx, tx, roleControl, c.ID, c, ErrControlNotFound); err != nil {
			return err
		}
		out = c
		return m.sendBack(ctx, tx, existing.DraftID, usageKey("control", existing.Code))
	})
	if err != nil {
		return models.Control{}, fmt.Errorf("UpdateControl: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteControl(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findControl(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		if err := m.deleteInDraft(ctx, tx, roleControlAttachment, existing.DraftID, "control_code = ?", existing.Code); err != nil {
			return err
		}
		if err := m.deleteWhere(ctx, tx, roleControl, "id = ?", id); err != nil {
			return err
		}
		return m.sendBack(ctx, tx, existing.DraftID, usageKey("control", existing.Code))
	})
	if err != nil {
		return fmt.Errorf("DeleteControl: %w", err)
	}
	return nil
}

func (m *agencyManager) findControl(ctx context.Context, tx *gorm.DB, id string) (models.Control, error) {
	var c models.Control
	if err := m.find(ctx, tx, roleControl, id, &c, ErrControlNotFound); err != nil {
		return models.Control{}, err
	}
	return c, nil
}
