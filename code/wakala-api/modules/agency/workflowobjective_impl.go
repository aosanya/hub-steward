package mwanachamaagency

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) validateWorkflowObjective(ctx context.Context, tx *gorm.DB, w models.WorkflowObjective) error {
	var workflow models.Workflow
	q := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkflow)), w.DraftID).Where("id = ?", w.WorkflowID)
	if err := m.take(q, roleWorkflow, &workflow, ErrWorkflowNotFound); err != nil {
		if errors.Is(err, ErrWorkflowNotFound) {
			return ErrWorkflowNotFound
		}
		return fmt.Errorf("validateWorkflowObjective: %w", err)
	}

	var objective models.Objective
	q = scopeQuery(tx.WithContext(ctx).Table(m.table(roleObjective)), w.DraftID).Where("id = ?", w.ObjectiveID)
	if err := m.take(q, roleObjective, &objective, ErrObjectiveNotFound); err != nil {
		if errors.Is(err, ErrObjectiveNotFound) {
			return ErrObjectiveNotFound
		}
		return fmt.Errorf("validateWorkflowObjective: %w", err)
	}

	var count int64
	linked := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkflowObjective)), w.DraftID).
		Where("workflow_id = ? AND objective_id = ?", w.WorkflowID, w.ObjectiveID)
	if err := linked.Count(&count).Error; err != nil {
		return fmt.Errorf("validateWorkflowObjective: %w", err)
	}
	if count > 0 {
		return ErrDuplicateWorkflowObjective
	}
	return nil
}

func (m *agencyManager) CreateWorkflowObjective(ctx context.Context, w models.WorkflowObjective) (models.WorkflowObjective, error) {
	if err := m.validateOpenDraftID(ctx, w.DraftID); err != nil {
		return models.WorkflowObjective{}, err
	}
	w.ID = newID()
	w.Deleted = false
	w.CreatedAt = models.NowRFC3339()
	w.LastUpdated = w.CreatedAt

	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := m.validateWorkflowObjective(ctx, tx, w); err != nil {
			return err
		}
		row, err := m.encode(roleWorkflowObjective, w)
		if err != nil {
			return err
		}
		return tx.Table(m.table(roleWorkflowObjective)).Create(row).Error
	})
	err = duplicateOr(err, ErrDuplicateWorkflowObjective)
	if err != nil {
		return models.WorkflowObjective{}, fmt.Errorf("CreateWorkflowObjective: %w", err)
	}
	return w, nil
}

func (m *agencyManager) GetWorkflowObjective(ctx context.Context, id string) (models.WorkflowObjective, error) {
	return m.findWorkflowObjective(ctx, m.db, id)
}

func (m *agencyManager) ListWorkflowObjectives(ctx context.Context, draftID string, filter WorkflowObjectiveFilter) ([]models.WorkflowObjective, error) {
	q := scopeQuery(m.q(ctx, roleWorkflowObjective), draftID)
	q = eqFilter(q, "workflow_id", filter.WorkflowID)
	q = eqFilter(q, "objective_id", filter.ObjectiveID)

	out, err := list[models.WorkflowObjective](m, q, roleWorkflowObjective)
	if err != nil {
		return nil, fmt.Errorf("ListWorkflowObjectives: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteWorkflowObjective(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findWorkflowObjective(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		return m.deleteWhere(ctx, tx, roleWorkflowObjective, "id = ?", id)
	})
	if err != nil {
		return fmt.Errorf("DeleteWorkflowObjective: %w", err)
	}
	return nil
}

func (m *agencyManager) deleteWorkflowObjectivesWhere(ctx context.Context, tx *gorm.DB, draftID, where string, args ...any) error {
	return m.deleteInDraft(ctx, tx, roleWorkflowObjective, draftID, where, args...)
}

func (m *agencyManager) findWorkflowObjective(ctx context.Context, tx *gorm.DB, id string) (models.WorkflowObjective, error) {
	var w models.WorkflowObjective
	if err := m.find(ctx, tx, roleWorkflowObjective, id, &w, ErrWorkflowObjectiveNotFound); err != nil {
		return models.WorkflowObjective{}, err
	}
	return w, nil
}
