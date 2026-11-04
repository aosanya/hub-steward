package mwanachamaagency

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

type targetFilters struct {
	RoleID, GoalID, ObjectiveID, WorkflowID, WorkItemID string
}

func (m *agencyManager) resolveCodeByID(ctx context.Context, tx *gorm.DB, role, id string, notFoundErr error) (string, error) {
	var codes []string
	if err := tx.WithContext(ctx).Table(m.table(role)).
		Where("id = ?", id).Limit(1).Pluck("code", &codes).Error; err != nil {
		return "", fmt.Errorf("resolveCodeByID: %w", err)
	}
	if len(codes) == 0 {
		return "", notFoundErr
	}
	return codes[0], nil
}

func hasAnyAttachment(ctx context.Context, tx *gorm.DB, attachmentsTable, codeColumn, code string) (bool, error) {
	var count int64
	if err := tx.WithContext(ctx).Table(attachmentsTable).Where(codeColumn+" = ?", code).Count(&count).Error; err != nil {
		return false, fmt.Errorf("hasAnyAttachment: %w", err)
	}
	return count > 0, nil
}

func (m *agencyManager) dropOrphanedAttachments(ctx context.Context, tx *gorm.DB, role, attachmentRole, codeColumn, code string) error {
	var survivors int64
	if err := tx.WithContext(ctx).Table(m.table(role)).Where("code = ?", code).Count(&survivors).Error; err != nil {
		return fmt.Errorf("dropOrphanedAttachments: %w", err)
	}
	if survivors > 0 {
		return nil
	}
	return m.deleteWhere(ctx, tx, attachmentRole, codeColumn+" = ?", code)
}

func (m *agencyManager) targetRole(t models.TargetType) (role string, notFound error, ok bool) {
	switch t {
	case models.TargetTypeRole:
		return roleRole, ErrRoleNotFound, true
	case models.TargetTypeGoal:
		return roleGoal, ErrGoalNotFound, true
	case models.TargetTypeObjective:
		return roleObjective, ErrObjectiveNotFound, true
	case models.TargetTypeWorkflow:
		return roleWorkflow, ErrWorkflowNotFound, true
	case models.TargetTypeWorkItem:
		return roleWorkItem, ErrWorkItemNotFound, true
	default:
		return "", nil, false
	}
}

func (m *agencyManager) resolveTargetCode(ctx context.Context, tx *gorm.DB, targetType models.TargetType, targetID string) (string, error) {
	role, notFound, ok := m.targetRole(targetType)
	if !ok {
		return "", ErrInvalidTargetType
	}
	return m.resolveCodeByID(ctx, tx, role, targetID, notFound)
}

func (m *agencyManager) applyTargetFilters(ctx context.Context, q *gorm.DB, attachmentsTable, codeColumn string, f targetFilters) (out *gorm.DB, matchable bool, err error) {
	targets := []struct {
		id         string
		targetType models.TargetType
	}{
		{f.RoleID, models.TargetTypeRole},
		{f.GoalID, models.TargetTypeGoal},
		{f.ObjectiveID, models.TargetTypeObjective},
		{f.WorkflowID, models.TargetTypeWorkflow},
		{f.WorkItemID, models.TargetTypeWorkItem},
	}
	for _, t := range targets {
		if t.id == "" {
			continue
		}
		code, err := m.resolveTargetCode(ctx, m.db, t.targetType, t.id)
		_, notFound, _ := m.targetRole(t.targetType)
		if errors.Is(err, notFound) {
			return q, false, nil
		}
		if err != nil {
			return q, false, err
		}
		q = q.Where("code IN (SELECT "+codeColumn+" FROM "+attachmentsTable+
			" WHERE target_type = ? AND target_code = ?)", string(t.targetType), code)
	}
	return q, true, nil
}
