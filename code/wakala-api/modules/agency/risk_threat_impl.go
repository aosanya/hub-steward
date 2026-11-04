package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

type RiskThreatFilter struct {
	RiskCode   string `query:"risk_code"`
	ThreatCode string `query:"threat_code"`
}

func (m *agencyManager) codeInDraft(ctx context.Context, tx *gorm.DB, role, draftID, code string) (bool, error) {
	var count int64
	err := tx.WithContext(ctx).Table(m.table(role)).
		Where("draft_id = ? AND code = ?", draftID, code).Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (m *agencyManager) requireCodeInDraft(ctx context.Context, tx *gorm.DB, role, draftID, code string, notFound error) error {
	found, err := m.codeInDraft(ctx, tx, role, draftID, code)
	if err != nil {
		return err
	}
	if !found {
		return notFound
	}
	return nil
}

func (m *agencyManager) CreateRiskThreat(ctx context.Context, l models.RiskThreat) (models.RiskThreat, error) {
	var out models.RiskThreat
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := m.requireOpenDraft(ctx, tx, l.DraftID); err != nil {
			return err
		}
		if err := m.requireCodeInDraft(ctx, tx, roleRisk, l.DraftID, l.RiskCode, ErrRiskNotFound); err != nil {
			return err
		}
		if err := m.requireCodeInDraft(ctx, tx, roleThreat, l.DraftID, l.ThreatCode, ErrThreatNotFound); err != nil {
			return err
		}
		var count int64
		if err := tx.WithContext(ctx).Table(m.table(roleRiskThreat)).
			Where("draft_id = ? AND risk_code = ? AND threat_code = ?", l.DraftID, l.RiskCode, l.ThreatCode).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return ErrDuplicateRiskThreat
		}
		l.ID = newID()
		l.CreatedAt = models.NowRFC3339()
		if err := m.copyRow(ctx, tx, roleRiskThreat, l); err != nil {
			return duplicateOr(err, ErrDuplicateRiskThreat)
		}
		out = l
		return nil
	})
	if err != nil {
		return models.RiskThreat{}, fmt.Errorf("CreateRiskThreat: %w", err)
	}
	return out, nil
}

func (m *agencyManager) ListRiskThreats(ctx context.Context, draftID string, filter RiskThreatFilter) ([]models.RiskThreat, error) {
	q := scopeQuery(m.q(ctx, roleRiskThreat).Order("created_at"), draftID)
	q = eqFilter(q, "risk_code", filter.RiskCode)
	q = eqFilter(q, "threat_code", filter.ThreatCode)

	out, err := list[models.RiskThreat](m, q, roleRiskThreat)
	if err != nil {
		return nil, fmt.Errorf("ListRiskThreats: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteRiskThreat(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var held models.RiskThreat
		if err := m.find(ctx, tx, roleRiskThreat, id, &held, ErrRiskThreatNotFound); err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, held.DraftID); err != nil {
			return err
		}
		return m.deleteWhere(ctx, tx, roleRiskThreat, "id = ?", id)
	})
	if err != nil {
		return fmt.Errorf("DeleteRiskThreat: %w", err)
	}
	return nil
}
