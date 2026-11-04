package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) CreateValue(ctx context.Context, v models.Value) (models.Value, error) {
	if v.Text == "" {
		return models.Value{}, fmt.Errorf("%w: Value.Text is required", ErrInvalidValue)
	}
	if err := m.validateOpenDraftID(ctx, v.DraftID); err != nil {
		return models.Value{}, err
	}
	v.ID = newID()
	v.Deleted = false
	v.CreatedAt = models.NowRFC3339()
	v.LastUpdated = v.CreatedAt

	err := m.createWithCode(ctx, roleValue, "value", "V", func(code string) any {
		v.Code = code
		return v
	})
	if err != nil {
		return models.Value{}, fmt.Errorf("CreateValue: %w", err)
	}
	return v, nil
}

func (m *agencyManager) GetValue(ctx context.Context, id string) (models.Value, error) {
	return m.findValue(ctx, m.db, id)
}

func (m *agencyManager) ListValues(ctx context.Context, draftID string, filter ValueFilter) ([]models.Value, error) {
	q := scopeQuery(m.q(ctx, roleValue), draftID)
	q = likeFilter(q, "code", filter.Code)
	q = likeFilter(q, "text", filter.Text)

	q, matchable, err := m.applyTargetFilters(ctx, q, m.table(roleValueAttachment), "value_code", targetFilters{
		RoleID: filter.RoleID, GoalID: filter.GoalID, ObjectiveID: filter.ObjectiveID,
		WorkflowID: filter.WorkflowID, WorkItemID: filter.WorkItemID,
	})
	if err != nil {
		return nil, fmt.Errorf("ListValues: %w", err)
	}
	if !matchable {
		return nil, nil
	}

	out, err := list[models.Value](m, q, roleValue)
	if err != nil {
		return nil, fmt.Errorf("ListValues: %w", err)
	}
	return out, nil
}

func (m *agencyManager) UpdateValue(ctx context.Context, v models.Value) (models.Value, error) {
	if v.Text == "" {
		return models.Value{}, fmt.Errorf("%w: Value.Text is required", ErrInvalidValue)
	}
	var out models.Value
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findValue(ctx, tx, v.ID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		attached, err := hasAnyAttachment(ctx, tx, m.table(roleValueAttachment), "value_code", existing.Code)
		if err != nil {
			return err
		}
		if !attached {
			return ErrCannotEditLive
		}
		v.Code = existing.Code
		v.DraftID = existing.DraftID
		v.CreatedAt = existing.CreatedAt
		v.LastUpdated = models.NowRFC3339()

		if err := m.writeUpdate(ctx, tx, roleValue, v.ID, v, ErrValueNotFound, "draft_id"); err != nil {
			return err
		}
		out = v
		return nil
	})
	if err != nil {
		return models.Value{}, fmt.Errorf("UpdateValue: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteValue(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findValue(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		attached, err := hasAnyAttachment(ctx, tx, m.table(roleValueAttachment), "value_code", existing.Code)
		if err != nil {
			return err
		}
		if !attached {
			return ErrCannotEditLive
		}
		if err := m.deleteWhere(ctx, tx, roleValue, "id = ?", id); err != nil {
			return err
		}
		return m.dropOrphanedAttachments(ctx, tx, roleValue, roleValueAttachment, "value_code", existing.Code)
	})
	if err != nil {
		return fmt.Errorf("DeleteValue: %w", err)
	}
	return nil
}

func (m *agencyManager) findValue(ctx context.Context, tx *gorm.DB, id string) (models.Value, error) {
	var v models.Value
	if err := m.find(ctx, tx, roleValue, id, &v, ErrValueNotFound); err != nil {
		return models.Value{}, err
	}
	return v, nil
}

func (m *agencyManager) CreateValueAttachment(ctx context.Context, valueID string, targetType models.TargetType, targetID string) (models.ValueAttachment, error) {
	var out models.ValueAttachment
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		valueCode, err := m.resolveCodeByID(ctx, tx, roleValue, valueID, ErrValueNotFound)
		if err != nil {
			return err
		}
		targetCode, err := m.resolveTargetCode(ctx, tx, targetType, targetID)
		if err != nil {
			return err
		}

		var count int64
		if err := tx.WithContext(ctx).Table(m.table(roleValueAttachment)).
			Where("value_code = ? AND target_type = ? AND target_code = ?", valueCode, string(targetType), targetCode).
			Count(&count).Error; err != nil {
			return fmt.Errorf("CreateValueAttachment: %w", err)
		}
		if count > 0 {
			return ErrDuplicateAttachment
		}

		a := models.ValueAttachment{
			ID:         newID(),
			ValueCode:  valueCode,
			TargetType: targetType,
			TargetCode: targetCode,
			CreatedAt:  models.NowRFC3339(),
		}
		if err := m.copyRow(ctx, tx, roleValueAttachment, a); err != nil {
			return fmt.Errorf("CreateValueAttachment: %w", duplicateOr(err, ErrDuplicateAttachment))
		}
		out = a
		return nil
	})
	if err != nil {
		return models.ValueAttachment{}, err
	}
	return out, nil
}

func (m *agencyManager) ListValueAttachments(ctx context.Context, valueID string) ([]models.ValueAttachment, error) {
	valueCode, err := m.resolveCodeByID(ctx, m.db, roleValue, valueID, ErrValueNotFound)
	if err != nil {
		return nil, err
	}
	q := m.q(ctx, roleValueAttachment).Where("value_code = ?", valueCode)

	out, err := list[models.ValueAttachment](m, q, roleValueAttachment)
	if err != nil {
		return nil, fmt.Errorf("ListValueAttachments: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteValueAttachment(ctx context.Context, id string) error {
	res := m.db.WithContext(ctx).Exec("delete from "+m.table(roleValueAttachment)+" where id = ?", id)
	if res.Error != nil {
		return fmt.Errorf("DeleteValueAttachment: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrValueAttachmentNotFound
	}
	return nil
}
