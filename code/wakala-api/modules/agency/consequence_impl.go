package mwanachamaagency

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) requireHazard(ctx context.Context, tx *gorm.DB, draftID, hazardCode string) error {
	code := strings.TrimSpace(hazardCode)
	if code == "" {
		return fmt.Errorf("%w: a consequence needs a hazard_code", ErrInvalidConsequence)
	}
	hazards, err := list[models.Hazard](m, scopeQuery(tx.WithContext(ctx).Table(m.table(roleHazard)), draftID), roleHazard)
	if err != nil {
		return err
	}
	for _, h := range hazards {
		if h.Code == code && !h.Deleted {
			return nil
		}
	}
	return fmt.Errorf("%w: no hazard %s in this draft", ErrHazardNotFound, code)
}

func (m *agencyManager) requireFreeConsequenceTitle(ctx context.Context, tx *gorm.DB, draftID, hazardCode, exceptID, title string) error {
	rows, err := list[models.Consequence](m, scopeQuery(tx.WithContext(ctx).Table(m.table(roleConsequence)), draftID), roleConsequence)
	if err != nil {
		return err
	}
	for _, row := range rows {
		if row.ID != exceptID && !row.Deleted && row.HazardCode == hazardCode && sameTitle(row.Title, title) {
			return fmt.Errorf("%w: a consequence titled %q already exists under hazard %s", ErrLibraryTitleTaken, strings.TrimSpace(title), hazardCode)
		}
	}
	return nil
}

func (m *agencyManager) CreateConsequence(ctx context.Context, p models.Consequence) (models.Consequence, error) {
	if strings.TrimSpace(p.Title) == "" {
		return models.Consequence{}, fmt.Errorf("CreateConsequence: %w: a consequence needs a title", ErrInvalidConsequence)
	}
	if err := m.validateOpenDraftID(ctx, p.DraftID); err != nil {
		return models.Consequence{}, fmt.Errorf("CreateConsequence: %w", err)
	}
	p.HazardCode = strings.TrimSpace(p.HazardCode)
	if err := m.requireHazard(ctx, m.db, p.DraftID, p.HazardCode); err != nil {
		return models.Consequence{}, fmt.Errorf("CreateConsequence: %w", err)
	}
	if err := m.requireFreeConsequenceTitle(ctx, m.db, p.DraftID, p.HazardCode, "", p.Title); err != nil {
		return models.Consequence{}, fmt.Errorf("CreateConsequence: %w", err)
	}
	p.ID = newID()
	p.Deleted = false
	p.CreatedAt = models.NowRFC3339()
	p.LastUpdated = p.CreatedAt
	err := m.createWithCode(ctx, roleConsequence, consequenceKind.entity, consequenceKind.prefix, func(code string) any {
		p.Code = code
		return p
	})
	if err != nil {
		return models.Consequence{}, fmt.Errorf("CreateConsequence: %w", err)
	}
	return p, nil
}

func (m *agencyManager) GetConsequence(ctx context.Context, id string) (models.Consequence, error) {
	var out models.Consequence
	if err := m.find(ctx, m.db, roleConsequence, id, &out, ErrConsequenceNotFound); err != nil {
		return models.Consequence{}, err
	}
	return out, nil
}

func (m *agencyManager) ListConsequences(ctx context.Context, draftID string, filter ConsequenceFilter) ([]models.Consequence, error) {
	q := scopeQuery(m.q(ctx, roleConsequence).Order("created_at"), draftID)
	q = likeFilter(q, "code", filter.Code)
	q = likeFilter(q, "title", filter.Title)
	q = likeFilter(q, "hazard_code", filter.HazardCode)
	out, err := list[models.Consequence](m, q, roleConsequence)
	if err != nil {
		return nil, fmt.Errorf("ListConsequences: %w", err)
	}
	return out, nil
}

func (m *agencyManager) UpdateConsequence(ctx context.Context, p models.Consequence) (models.Consequence, error) {
	if strings.TrimSpace(p.Title) == "" {
		return models.Consequence{}, fmt.Errorf("UpdateConsequence: %w: a consequence needs a title", ErrInvalidConsequence)
	}
	p.HazardCode = strings.TrimSpace(p.HazardCode)
	var out models.Consequence
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing models.Consequence
		if err := m.find(ctx, tx, roleConsequence, p.ID, &existing, ErrConsequenceNotFound); err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		if err := m.requireHazard(ctx, tx, existing.DraftID, p.HazardCode); err != nil {
			return err
		}
		if err := m.requireFreeConsequenceTitle(ctx, tx, existing.DraftID, p.HazardCode, existing.ID, p.Title); err != nil {
			return err
		}
		p.Code = existing.Code
		p.DraftID = existing.DraftID
		p.CreatedAt = existing.CreatedAt
		p.LastUpdated = models.NowRFC3339()
		if err := m.writeUpdate(ctx, tx, roleConsequence, p.ID, p, ErrConsequenceNotFound); err != nil {
			return err
		}
		out = p
		return nil
	})
	if err != nil {
		return models.Consequence{}, fmt.Errorf("UpdateConsequence: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteConsequence(ctx context.Context, id string) error {
	if err := m.deletePart(ctx, consequenceKind, id); err != nil {
		return fmt.Errorf("DeleteConsequence: %w", err)
	}
	return nil
}
