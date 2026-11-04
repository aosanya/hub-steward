package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) controlTargetRole(t models.TargetType) (role string, notFound error, ok bool) {
	if t == models.TargetTypeRiskPathway {
		return roleRiskPathway, ErrRiskPathwayNotFound, true
	}
	if t == models.TargetTypeThreat {
		return roleThreat, ErrThreatNotFound, true
	}
	if t == models.TargetTypeConsequence {
		return roleConsequence, ErrConsequenceNotFound, true
	}
	return m.targetRole(t)
}

func (m *agencyManager) resolveControlTargetCode(ctx context.Context, tx *gorm.DB, draftID string, t models.TargetType, targetID string) (string, error) {
	if !t.ValidForControl() {
		return "", ErrInvalidTargetType
	}
	role, notFound, _ := m.controlTargetRole(t)
	var codes []string
	if err := tx.WithContext(ctx).Table(m.table(role)).
		Where("id = ? AND draft_id = ?", targetID, draftID).Limit(1).Pluck("code", &codes).Error; err != nil {
		return "", fmt.Errorf("resolveControlTargetCode: %w", err)
	}
	if len(codes) == 0 {
		return "", notFound
	}
	return codes[0], nil
}

func (m *agencyManager) CreateControlAttachment(ctx context.Context, controlID string, targetType models.TargetType, targetID string) (models.ControlAttachment, error) {
	var out models.ControlAttachment
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		control, err := m.findControl(ctx, tx, controlID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, control.DraftID); err != nil {
			return err
		}
		targetCode, err := m.resolveControlTargetCode(ctx, tx, control.DraftID, targetType, targetID)
		if err != nil {
			return err
		}

		var count int64
		if err := tx.WithContext(ctx).Table(m.table(roleControlAttachment)).
			Where("draft_id = ? AND control_code = ? AND target_type = ? AND target_code = ?",
				control.DraftID, control.Code, string(targetType), targetCode).
			Count(&count).Error; err != nil {
			return fmt.Errorf("CreateControlAttachment: %w", err)
		}
		if count > 0 {
			return ErrDuplicateControlAttachment
		}

		a := models.ControlAttachment{
			ID:          newID(),
			DraftID:     control.DraftID,
			ControlCode: control.Code,
			TargetType:  targetType,
			TargetCode:  targetCode,
			CreatedAt:   models.NowRFC3339(),
		}
		if err := m.copyRow(ctx, tx, roleControlAttachment, a); err != nil {
			return fmt.Errorf("CreateControlAttachment: %w", duplicateOr(err, ErrDuplicateControlAttachment))
		}
		out = a
		return m.sendBack(ctx, tx, control.DraftID, usageKey("control", control.Code), usageKey(string(targetType), targetCode))
	})
	if err != nil {
		return models.ControlAttachment{}, err
	}
	return out, nil
}

func (m *agencyManager) ListControlAttachments(ctx context.Context, controlID string) ([]models.ControlAttachment, error) {
	control, err := m.findControl(ctx, m.db, controlID)
	if err != nil {
		return nil, err
	}
	q := m.q(ctx, roleControlAttachment).
		Where("draft_id = ? AND control_code = ?", control.DraftID, control.Code).
		Order("created_at")

	out, err := list[models.ControlAttachment](m, q, roleControlAttachment)
	if err != nil {
		return nil, fmt.Errorf("ListControlAttachments: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteControlAttachment(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var held models.ControlAttachment
		if err := m.find(ctx, tx, roleControlAttachment, id, &held, ErrControlAttachmentNotFound); err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, held.DraftID); err != nil {
			return err
		}
		if err := m.deleteWhere(ctx, tx, roleControlAttachment, "id = ?", id); err != nil {
			return err
		}
		return m.sendBack(ctx, tx, held.DraftID, usageKey("control", held.ControlCode), usageKey(string(held.TargetType), held.TargetCode))
	})
	if err != nil {
		return fmt.Errorf("DeleteControlAttachment: %w", err)
	}
	return nil
}
