package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) CreateRule(ctx context.Context, v models.Rule) (models.Rule, error) {
	if v.Text == "" {
		return models.Rule{}, fmt.Errorf("%w: Rule.Text is required", ErrInvalidRule)
	}
	if err := m.validateOpenDraftID(ctx, v.DraftID); err != nil {
		return models.Rule{}, err
	}
	v.ID = newID()
	v.Deleted = false
	v.CreatedAt = models.NowRFC3339()
	v.LastUpdated = v.CreatedAt

	err := m.createWithCode(ctx, roleRule, "rule", "RU", func(code string) any {
		v.Code = code
		return v
	})
	if err != nil {
		return models.Rule{}, fmt.Errorf("CreateRule: %w", err)
	}
	return v, nil
}

func (m *agencyManager) GetRule(ctx context.Context, id string) (models.Rule, error) {
	return m.findRule(ctx, m.db, id)
}

func (m *agencyManager) ListRules(ctx context.Context, draftID string, filter RuleFilter) ([]models.Rule, error) {
	q := scopeQuery(m.q(ctx, roleRule), draftID)
	q = likeFilter(q, "code", filter.Code)
	q = likeFilter(q, "text", filter.Text)

	q, matchable, err := m.applyTargetFilters(ctx, q, m.table(roleRuleAttachment), "rule_code", targetFilters{
		RoleID: filter.RoleID, GoalID: filter.GoalID, ObjectiveID: filter.ObjectiveID,
		WorkflowID: filter.WorkflowID, WorkItemID: filter.WorkItemID,
	})
	if err != nil {
		return nil, fmt.Errorf("ListRules: %w", err)
	}
	if !matchable {
		return nil, nil
	}

	out, err := list[models.Rule](m, q, roleRule)
	if err != nil {
		return nil, fmt.Errorf("ListRules: %w", err)
	}
	return out, nil
}

func (m *agencyManager) UpdateRule(ctx context.Context, v models.Rule) (models.Rule, error) {
	if v.Text == "" {
		return models.Rule{}, fmt.Errorf("%w: Rule.Text is required", ErrInvalidRule)
	}
	var out models.Rule
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findRule(ctx, tx, v.ID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		attached, err := hasAnyAttachment(ctx, tx, m.table(roleRuleAttachment), "rule_code", existing.Code)
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

		if err := m.writeUpdate(ctx, tx, roleRule, v.ID, v, ErrRuleNotFound, "draft_id"); err != nil {
			return err
		}
		out = v
		return m.sendBack(ctx, tx, existing.DraftID, usageKey("rule", existing.Code))
	})
	if err != nil {
		return models.Rule{}, fmt.Errorf("UpdateRule: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteRule(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findRule(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		attached, err := hasAnyAttachment(ctx, tx, m.table(roleRuleAttachment), "rule_code", existing.Code)
		if err != nil {
			return err
		}
		if !attached {
			return ErrCannotEditLive
		}
		if err := m.deleteWhere(ctx, tx, roleRule, "id = ?", id); err != nil {
			return err
		}
		if err := m.sendBack(ctx, tx, existing.DraftID, usageKey("rule", existing.Code)); err != nil {
			return err
		}
		return m.dropOrphanedAttachments(ctx, tx, roleRule, roleRuleAttachment, "rule_code", existing.Code)
	})
	if err != nil {
		return fmt.Errorf("DeleteRule: %w", err)
	}
	return nil
}

func (m *agencyManager) findRule(ctx context.Context, tx *gorm.DB, id string) (models.Rule, error) {
	var v models.Rule
	if err := m.find(ctx, tx, roleRule, id, &v, ErrRuleNotFound); err != nil {
		return models.Rule{}, err
	}
	return v, nil
}

func (m *agencyManager) CreateRuleAttachment(ctx context.Context, ruleID string, targetType models.TargetType, targetID string) (models.RuleAttachment, error) {
	var out models.RuleAttachment
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		ruleCode, err := m.resolveCodeByID(ctx, tx, roleRule, ruleID, ErrRuleNotFound)
		if err != nil {
			return err
		}
		targetCode, err := m.resolveTargetCode(ctx, tx, targetType, targetID)
		if err != nil {
			return err
		}

		var count int64
		if err := tx.WithContext(ctx).Table(m.table(roleRuleAttachment)).
			Where("rule_code = ? AND target_type = ? AND target_code = ?", ruleCode, string(targetType), targetCode).
			Count(&count).Error; err != nil {
			return fmt.Errorf("CreateRuleAttachment: %w", err)
		}
		if count > 0 {
			return ErrDuplicateAttachment
		}

		a := models.RuleAttachment{
			ID:         newID(),
			RuleCode:   ruleCode,
			TargetType: targetType,
			TargetCode: targetCode,
			CreatedAt:  models.NowRFC3339(),
		}
		if err := m.copyRow(ctx, tx, roleRuleAttachment, a); err != nil {
			return fmt.Errorf("CreateRuleAttachment: %w", duplicateOr(err, ErrDuplicateAttachment))
		}
		out = a
		return m.sendBack(ctx, tx, "", usageKey(string(targetType), targetCode))
	})
	if err != nil {
		return models.RuleAttachment{}, err
	}
	return out, nil
}

func (m *agencyManager) ListRuleAttachments(ctx context.Context, ruleID string) ([]models.RuleAttachment, error) {
	ruleCode, err := m.resolveCodeByID(ctx, m.db, roleRule, ruleID, ErrRuleNotFound)
	if err != nil {
		return nil, err
	}
	q := m.q(ctx, roleRuleAttachment).Where("rule_code = ?", ruleCode)

	out, err := list[models.RuleAttachment](m, q, roleRuleAttachment)
	if err != nil {
		return nil, fmt.Errorf("ListRuleAttachments: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteRuleAttachment(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var held models.RuleAttachment
		if err := m.find(ctx, tx, roleRuleAttachment, id, &held, ErrRuleAttachmentNotFound); err != nil {
			return err
		}
		if err := m.deleteWhere(ctx, tx, roleRuleAttachment, "id = ?", id); err != nil {
			return err
		}
		return m.sendBack(ctx, tx, "", usageKey(string(held.TargetType), held.TargetCode))
	})
	if err != nil {
		return fmt.Errorf("DeleteRuleAttachment: %w", err)
	}
	return nil
}
