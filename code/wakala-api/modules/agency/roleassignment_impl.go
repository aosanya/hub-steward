package mwanachamaagency

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) validateRoleAssignment(ctx context.Context, tx *gorm.DB, a models.RoleAssignment, excludeID string) error {
	if !a.Label.Valid() {
		return ErrInvalidRACILabel
	}

	var r models.Role
	q := scopeQuery(tx.WithContext(ctx).Table(m.table(roleRole)), a.DraftID).Where("id = ?", a.RoleID)
	if err := m.take(q, roleRole, &r, ErrRoleNotFound); err != nil {
		if errors.Is(err, ErrRoleNotFound) {
			return ErrRoleNotFound
		}
		return fmt.Errorf("validateRoleAssignment: %w", err)
	}

	var wi models.WorkItem
	q = scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkItem)), a.DraftID).Where("id = ?", a.WorkItemID)
	if err := m.take(q, roleWorkItem, &wi, ErrWorkItemNotFound); err != nil {
		if errors.Is(err, ErrWorkItemNotFound) {
			return ErrWorkItemNotFound
		}
		return fmt.Errorf("validateRoleAssignment: %w", err)
	}

	held := scopeQuery(tx.WithContext(ctx).Table(m.table(roleRoleAssignment)), a.DraftID).
		Where("work_item_id = ? AND role_id = ? AND label = ?", a.WorkItemID, a.RoleID, string(a.Label))
	if excludeID != "" {
		held = held.Where("id <> ?", excludeID)
	}
	var count int64
	if err := held.Count(&count).Error; err != nil {
		return fmt.Errorf("validateRoleAssignment: %w", err)
	}
	if count > 0 {
		return ErrDuplicateRoleAssignment
	}
	return nil
}

func (m *agencyManager) CreateRoleAssignment(ctx context.Context, a models.RoleAssignment) (models.RoleAssignment, error) {
	if err := m.validateOpenDraftID(ctx, a.DraftID); err != nil {
		return models.RoleAssignment{}, err
	}
	a.ID = newID()
	a.Deleted = false
	a.CreatedAt = models.NowRFC3339()
	a.LastUpdated = a.CreatedAt

	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := m.validateRoleAssignment(ctx, tx, a, ""); err != nil {
			return err
		}
		row, err := m.encode(roleRoleAssignment, a)
		if err != nil {
			return err
		}
		return tx.Table(m.table(roleRoleAssignment)).Create(row).Error
	})
	err = duplicateOr(err, ErrDuplicateRoleAssignment)
	if err != nil {
		return models.RoleAssignment{}, fmt.Errorf("CreateRoleAssignment: %w", err)
	}
	return a, nil
}

func (m *agencyManager) GetRoleAssignment(ctx context.Context, id string) (models.RoleAssignment, error) {
	return m.findRoleAssignment(ctx, m.db, id)
}

func (m *agencyManager) ListRoleAssignments(ctx context.Context, draftID string, filter RoleAssignmentFilter) ([]models.RoleAssignment, error) {
	q := scopeQuery(m.q(ctx, roleRoleAssignment), draftID)
	q = eqFilter(q, "label", filter.Label)
	q = eqFilter(q, "work_item_id", filter.WorkItemID)
	q = eqFilter(q, "role_id", filter.RoleID)

	out, err := list[models.RoleAssignment](m, q, roleRoleAssignment)
	if err != nil {
		return nil, fmt.Errorf("ListRoleAssignments: %w", err)
	}
	return out, nil
}

func (m *agencyManager) ListRoleAssignmentsForWorkItem(ctx context.Context, workItemID, draftID string, filter RoleAssignmentFilter) ([]models.RoleAssignment, error) {
	q := scopeQuery(m.q(ctx, roleRoleAssignment), draftID).Where("work_item_id = ?", workItemID)
	q = eqFilter(q, "label", filter.Label)
	q = eqFilter(q, "role_id", filter.RoleID)

	out, err := list[models.RoleAssignment](m, q, roleRoleAssignment)
	if err != nil {
		return nil, fmt.Errorf("ListRoleAssignmentsForWorkItem: %w", err)
	}
	return out, nil
}

func (m *agencyManager) UpdateRoleAssignment(ctx context.Context, a models.RoleAssignment) (models.RoleAssignment, error) {
	var out models.RoleAssignment
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findRoleAssignment(ctx, tx, a.ID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		a.DraftID = existing.DraftID
		if err := m.validateRoleAssignment(ctx, tx, a, a.ID); err != nil {
			return err
		}
		a.CreatedAt = existing.CreatedAt
		a.LastUpdated = models.NowRFC3339()

		if err := m.writeUpdate(ctx, tx, roleRoleAssignment, a.ID, a, ErrRoleAssignmentNotFound, "draft_id"); err != nil {
			return err
		}
		out = a
		return nil
	})
	err = duplicateOr(err, ErrDuplicateRoleAssignment)
	if err != nil {
		return models.RoleAssignment{}, fmt.Errorf("UpdateRoleAssignment: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteRoleAssignment(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findRoleAssignment(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		return m.deleteWhere(ctx, tx, roleRoleAssignment, "id = ?", id)
	})
	if err != nil {
		return fmt.Errorf("DeleteRoleAssignment: %w", err)
	}
	return nil
}

func (m *agencyManager) findRoleAssignment(ctx context.Context, tx *gorm.DB, id string) (models.RoleAssignment, error) {
	var a models.RoleAssignment
	if err := m.find(ctx, tx, roleRoleAssignment, id, &a, ErrRoleAssignmentNotFound); err != nil {
		return models.RoleAssignment{}, err
	}
	return a, nil
}
