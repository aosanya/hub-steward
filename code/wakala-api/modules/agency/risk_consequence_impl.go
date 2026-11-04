package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

type RiskConsequenceFilter struct {
	RiskCode        string `query:"risk_code"`
	ConsequenceCode string `query:"consequence_code"`
}

func (m *agencyManager) CreateRiskConsequence(ctx context.Context, l models.RiskConsequence) (models.RiskConsequence, error) {
	var out models.RiskConsequence
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := m.requireOpenDraft(ctx, tx, l.DraftID); err != nil {
			return err
		}
		if err := m.requireCodeInDraft(ctx, tx, roleRisk, l.DraftID, l.RiskCode, ErrRiskNotFound); err != nil {
			return err
		}
		if err := m.requireCodeInDraft(ctx, tx, roleConsequence, l.DraftID, l.ConsequenceCode, ErrConsequenceNotFound); err != nil {
			return err
		}
		if err := m.requireSameHazard(ctx, tx, l); err != nil {
			return err
		}
		var count int64
		if err := tx.WithContext(ctx).Table(m.table(roleRiskConsequence)).
			Where("draft_id = ? AND risk_code = ? AND consequence_code = ?", l.DraftID, l.RiskCode, l.ConsequenceCode).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrDuplicateRiskConsequence
		}
		l.ID = newID()
		l.CreatedAt = models.NowRFC3339()
		if err := m.copyRow(ctx, tx, roleRiskConsequence, l); err != nil {
			return duplicateOr(err, ErrDuplicateRiskConsequence)
		}
		out = l
		return nil
	})
	if err != nil {
		return models.RiskConsequence{}, fmt.Errorf("CreateRiskConsequence: %w", err)
	}
	return out, nil
}

func (m *agencyManager) hazardCodeOf(ctx context.Context, tx *gorm.DB, role, draftID, code string) (string, error) {
	var codes []string
	err := tx.WithContext(ctx).Table(m.table(role)).
		Where("draft_id = ? AND code = ?", draftID, code).Pluck("hazard_code", &codes).Error
	if err != nil || len(codes) == 0 {
		return "", err
	}
	return codes[0], nil
}

func (m *agencyManager) requireSameHazard(ctx context.Context, tx *gorm.DB, l models.RiskConsequence) error {
	riskHazard, err := m.hazardCodeOf(ctx, tx, roleRisk, l.DraftID, l.RiskCode)
	if err != nil {
		return err
	}
	if riskHazard == "" {
		return fmt.Errorf("%w: risk %s names no hazard", ErrConsequenceOutsideHazard, l.RiskCode)
	}
	consequenceHazard, err := m.hazardCodeOf(ctx, tx, roleConsequence, l.DraftID, l.ConsequenceCode)
	if err != nil {
		return err
	}
	if consequenceHazard != riskHazard {
		return fmt.Errorf("%w: consequence %s belongs to hazard %s, risk %s to %s", ErrConsequenceOutsideHazard, l.ConsequenceCode, consequenceHazard, l.RiskCode, riskHazard)
	}
	return nil
}

func (m *agencyManager) requireLinkedConsequencesFit(ctx context.Context, tx *gorm.DB, draftID, riskCode, newHazard string) error {
	var linked []string
	err := tx.WithContext(ctx).Table(m.table(roleRiskConsequence)).
		Where("draft_id = ? AND risk_code = ?", draftID, riskCode).Pluck("consequence_code", &linked).Error
	if err != nil {
		return err
	}
	for _, code := range linked {
		hazard, err := m.hazardCodeOf(ctx, tx, roleConsequence, draftID, code)
		if err != nil {
			return err
		}
		if hazard != newHazard {
			return fmt.Errorf("%w: risk %s still links consequence %s of hazard %s", ErrConsequenceOutsideHazard, riskCode, code, hazard)
		}
	}
	return nil
}

func (m *agencyManager) ListRiskConsequences(ctx context.Context, draftID string, filter RiskConsequenceFilter) ([]models.RiskConsequence, error) {
	q := scopeQuery(m.q(ctx, roleRiskConsequence).Order("created_at"), draftID)
	q = eqFilter(q, "risk_code", filter.RiskCode)
	q = eqFilter(q, "consequence_code", filter.ConsequenceCode)

	out, err := list[models.RiskConsequence](m, q, roleRiskConsequence)
	if err != nil {
		return nil, fmt.Errorf("ListRiskConsequences: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteRiskConsequence(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var held models.RiskConsequence
		if err := m.find(ctx, tx, roleRiskConsequence, id, &held, ErrRiskConsequenceNotFound); err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, held.DraftID); err != nil {
			return err
		}
		return m.deleteWhere(ctx, tx, roleRiskConsequence, "id = ?", id)
	})
	if err != nil {
		return fmt.Errorf("DeleteRiskConsequence: %w", err)
	}
	return nil
}
