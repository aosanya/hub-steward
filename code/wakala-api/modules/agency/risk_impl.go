package mwanachamaagency

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func validRisk(r models.Risk) error {
	if strings.TrimSpace(r.Title) == "" || strings.TrimSpace(r.TopEvent) == "" {
		return fmt.Errorf("%w: a risk needs a title and a top event", ErrInvalidRisk)
	}
	return nil
}

func validRiskPathway(p models.RiskPathway) error {
	if !p.Side.Valid() {
		return fmt.Errorf("%w: side must be threat or consequence", ErrInvalidRiskPathway)
	}
	if strings.TrimSpace(p.Title) == "" {
		return fmt.Errorf("%w: a pathway needs a title", ErrInvalidRiskPathway)
	}
	return nil
}

func (m *agencyManager) requireHazardCode(ctx context.Context, tx *gorm.DB, draftID, code string) error {
	if code == "" {
		return nil
	}
	return m.requireCodeInDraft(ctx, tx, roleHazard, draftID, code, ErrHazardNotFound)
}

func (m *agencyManager) CreateRisk(ctx context.Context, r models.Risk) (models.Risk, error) {
	if err := validRisk(r); err != nil {
		return models.Risk{}, err
	}
	if err := m.validateOpenDraftID(ctx, r.DraftID); err != nil {
		return models.Risk{}, err
	}
	if err := m.requireHazardCode(ctx, m.db, r.DraftID, r.HazardCode); err != nil {
		return models.Risk{}, fmt.Errorf("CreateRisk: %w", err)
	}
	r.ID = newID()
	r.Deleted = false
	r.CreatedAt = models.NowRFC3339()
	r.LastUpdated = r.CreatedAt

	err := m.createWithCode(ctx, roleRisk, "risk", "RK", func(code string) any {
		r.Code = code
		return r
	})
	if err != nil {
		return models.Risk{}, fmt.Errorf("CreateRisk: %w", err)
	}
	return r, nil
}

func (m *agencyManager) GetRisk(ctx context.Context, id string) (models.Risk, error) {
	return m.findRisk(ctx, m.db, id)
}

func (m *agencyManager) ListRisks(ctx context.Context, draftID string, filter RiskFilter) ([]models.Risk, error) {
	q := scopeQuery(m.q(ctx, roleRisk).Order("created_at"), draftID)
	q = likeFilter(q, "code", filter.Code)
	q = likeFilter(q, "title", filter.Title)

	out, err := list[models.Risk](m, q, roleRisk)
	if err != nil {
		return nil, fmt.Errorf("ListRisks: %w", err)
	}
	return out, nil
}

func (m *agencyManager) UpdateRisk(ctx context.Context, r models.Risk) (models.Risk, error) {
	if err := validRisk(r); err != nil {
		return models.Risk{}, err
	}
	var out models.Risk
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findRisk(ctx, tx, r.ID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		if err := m.requireHazardCode(ctx, tx, existing.DraftID, r.HazardCode); err != nil {
			return err
		}
		if r.HazardCode != existing.HazardCode {
			if err := m.requireLinkedConsequencesFit(ctx, tx, existing.DraftID, existing.Code, r.HazardCode); err != nil {
				return err
			}
		}
		r.Code = existing.Code
		r.DraftID = existing.DraftID
		r.CreatedAt = existing.CreatedAt
		r.LastUpdated = models.NowRFC3339()

		if err := m.writeUpdate(ctx, tx, roleRisk, r.ID, r, ErrRiskNotFound); err != nil {
			return err
		}
		out = r
		return nil
	})
	if err != nil {
		return models.Risk{}, fmt.Errorf("UpdateRisk: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteRisk(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findRisk(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		if err := m.deleteInDraft(ctx, tx, roleRiskPathway, existing.DraftID, "risk_id = ?", id); err != nil {
			return err
		}
		return m.deleteWhere(ctx, tx, roleRisk, "id = ?", id)
	})
	if err != nil {
		return fmt.Errorf("DeleteRisk: %w", err)
	}
	return nil
}

func (m *agencyManager) findRisk(ctx context.Context, tx *gorm.DB, id string) (models.Risk, error) {
	var r models.Risk
	if err := m.find(ctx, tx, roleRisk, id, &r, ErrRiskNotFound); err != nil {
		return models.Risk{}, err
	}
	return r, nil
}

func (m *agencyManager) CreateRiskPathway(ctx context.Context, p models.RiskPathway) (models.RiskPathway, error) {
	if err := validRiskPathway(p); err != nil {
		return models.RiskPathway{}, err
	}
	if err := m.validateOpenDraftID(ctx, p.DraftID); err != nil {
		return models.RiskPathway{}, err
	}
	risk, err := m.findRisk(ctx, m.db, p.RiskID)
	if err != nil || risk.DraftID != p.DraftID {
		return models.RiskPathway{}, fmt.Errorf("CreateRiskPathway: %w", ErrRiskNotFound)
	}
	p.ID = newID()
	p.Deleted = false
	p.CreatedAt = models.NowRFC3339()
	p.LastUpdated = p.CreatedAt

	err = m.createWithCode(ctx, roleRiskPathway, "risk_pathway", "RP", func(code string) any {
		p.Code = code
		return p
	})
	if err != nil {
		return models.RiskPathway{}, fmt.Errorf("CreateRiskPathway: %w", err)
	}
	return p, nil
}

func (m *agencyManager) GetRiskPathway(ctx context.Context, id string) (models.RiskPathway, error) {
	return m.findRiskPathway(ctx, m.db, id)
}

func (m *agencyManager) ListRiskPathways(ctx context.Context, draftID string, filter RiskPathwayFilter) ([]models.RiskPathway, error) {
	q := scopeQuery(m.q(ctx, roleRiskPathway).Order("created_at"), draftID)
	q = eqFilter(q, "risk_id", filter.RiskID)
	q = eqFilter(q, "side", filter.Side)
	q = likeFilter(q, "title", filter.Title)

	out, err := list[models.RiskPathway](m, q, roleRiskPathway)
	if err != nil {
		return nil, fmt.Errorf("ListRiskPathways: %w", err)
	}
	return out, nil
}

func (m *agencyManager) UpdateRiskPathway(ctx context.Context, p models.RiskPathway) (models.RiskPathway, error) {
	if err := validRiskPathway(p); err != nil {
		return models.RiskPathway{}, err
	}
	var out models.RiskPathway
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findRiskPathway(ctx, tx, p.ID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		p.Code = existing.Code
		p.DraftID = existing.DraftID
		p.RiskID = existing.RiskID
		p.CreatedAt = existing.CreatedAt
		p.LastUpdated = models.NowRFC3339()

		if err := m.writeUpdate(ctx, tx, roleRiskPathway, p.ID, p, ErrRiskPathwayNotFound); err != nil {
			return err
		}
		out = p
		return nil
	})
	if err != nil {
		return models.RiskPathway{}, fmt.Errorf("UpdateRiskPathway: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteRiskPathway(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findRiskPathway(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		return m.deleteWhere(ctx, tx, roleRiskPathway, "id = ?", id)
	})
	if err != nil {
		return fmt.Errorf("DeleteRiskPathway: %w", err)
	}
	return nil
}

func (m *agencyManager) findRiskPathway(ctx context.Context, tx *gorm.DB, id string) (models.RiskPathway, error) {
	var p models.RiskPathway
	if err := m.find(ctx, tx, roleRiskPathway, id, &p, ErrRiskPathwayNotFound); err != nil {
		return models.RiskPathway{}, err
	}
	return p, nil
}
