package mwanachamaagency

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
	"wakalaserver/modules/shared/plaintext"
)

type LibraryPartFilter struct {
	Code  string `query:"code"`
	Title string `query:"title"`
}

type HazardFilter = LibraryPartFilter
type ThreatFilter = LibraryPartFilter
type ConsequenceFilter struct {
	Code       string `query:"code"`
	Title      string `query:"title"`
	HazardCode string `query:"hazard_code"`
}

type libraryKind struct {
	role       string
	entity     string
	prefix     string
	usageRole  string
	usageField string
	invalid    error
	notFound   error
}

var (
	hazardKind      = libraryKind{roleHazard, "hazard", "H", roleRisk, "hazard_code", ErrInvalidHazard, ErrHazardNotFound}
	threatKind      = libraryKind{roleThreat, "threat", "T", roleRiskThreat, "threat_code", ErrInvalidThreat, ErrThreatNotFound}
	consequenceKind = libraryKind{roleConsequence, "consequence", "Q", roleRiskConsequence, "consequence_code", ErrInvalidConsequence, ErrConsequenceNotFound}
)

func sameTitle(a, b string) bool {
	return plaintext.SameNameIgnoringCase(a, b)
}

func (m *agencyManager) requireFreeTitle(ctx context.Context, tx *gorm.DB, k libraryKind, draftID, exceptID, title string) error {
	rows, err := list[models.Hazard](m, scopeQuery(tx.WithContext(ctx).Table(m.table(k.role)), draftID), k.role)
	if err != nil {
		return err
	}
	for _, row := range rows {
		if row.ID != exceptID && !row.Deleted && sameTitle(row.Title, title) {
			return fmt.Errorf("%w: a %s titled %q already exists in this draft", ErrLibraryTitleTaken, k.entity, strings.TrimSpace(title))
		}
	}
	return nil
}

func (m *agencyManager) createPart(ctx context.Context, k libraryKind, p models.Hazard) (models.Hazard, error) {
	if strings.TrimSpace(p.Title) == "" {
		return models.Hazard{}, fmt.Errorf("%w: a %s needs a title", k.invalid, k.entity)
	}
	if err := m.validateOpenDraftID(ctx, p.DraftID); err != nil {
		return models.Hazard{}, err
	}
	if err := m.requireFreeTitle(ctx, m.db, k, p.DraftID, "", p.Title); err != nil {
		return models.Hazard{}, err
	}
	p.ID = newID()
	p.Deleted = false
	p.CreatedAt = models.NowRFC3339()
	p.LastUpdated = p.CreatedAt

	err := m.createWithCode(ctx, k.role, k.entity, k.prefix, func(code string) any {
		p.Code = code
		return p
	})
	if err != nil {
		return models.Hazard{}, err
	}
	return p, nil
}

func (m *agencyManager) findPart(ctx context.Context, tx *gorm.DB, k libraryKind, id string) (models.Hazard, error) {
	var p models.Hazard
	if err := m.find(ctx, tx, k.role, id, &p, k.notFound); err != nil {
		return models.Hazard{}, err
	}
	return p, nil
}

func (m *agencyManager) listParts(ctx context.Context, k libraryKind, draftID string, filter LibraryPartFilter) ([]models.Hazard, error) {
	q := scopeQuery(m.q(ctx, k.role).Order("created_at"), draftID)
	q = likeFilter(q, "code", filter.Code)
	q = likeFilter(q, "title", filter.Title)
	return list[models.Hazard](m, q, k.role)
}

func (m *agencyManager) updatePart(ctx context.Context, k libraryKind, p models.Hazard) (models.Hazard, error) {
	if strings.TrimSpace(p.Title) == "" {
		return models.Hazard{}, fmt.Errorf("%w: a %s needs a title", k.invalid, k.entity)
	}
	var out models.Hazard
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findPart(ctx, tx, k, p.ID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		if err := m.requireFreeTitle(ctx, tx, k, existing.DraftID, existing.ID, p.Title); err != nil {
			return err
		}
		p.Code = existing.Code
		p.DraftID = existing.DraftID
		p.CreatedAt = existing.CreatedAt
		p.LastUpdated = models.NowRFC3339()
		if err := m.writeUpdate(ctx, tx, k.role, p.ID, p, k.notFound); err != nil {
			return err
		}
		out = p
		return nil
	})
	if err != nil {
		return models.Hazard{}, err
	}
	return out, nil
}

func (m *agencyManager) countWhere(ctx context.Context, tx *gorm.DB, role, where string, args ...any) (int64, error) {
	var n int64
	err := tx.WithContext(ctx).Table(m.table(role)).Where(where, args...).Count(&n).Error
	return n, err
}

func (m *agencyManager) deletePart(ctx context.Context, k libraryKind, id string) error {
	return m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findPart(ctx, tx, k, id)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		linked, err := m.countWhere(ctx, tx, k.usageRole, "draft_id = ? AND "+k.usageField+" = ?", existing.DraftID, existing.Code)
		if err != nil {
			return err
		}
		consequences, err := m.consequencesNaming(ctx, tx, k, existing)
		if err != nil {
			return err
		}
		if linked > 0 || len(consequences) > 0 {
			return fmt.Errorf("%w: %s %s is used by %d risk link(s) and %d consequence(s) %v", ErrLibraryPartInUse, k.entity, existing.Code, linked, len(consequences), consequences)
		}
		if k.role != roleHazard {
			if err := m.deleteWhere(ctx, tx, roleControlAttachment, "draft_id = ? AND target_type = ? AND target_code = ?", existing.DraftID, k.entity, existing.Code); err != nil {
				return err
			}
		}
		return m.deleteWhere(ctx, tx, k.role, "id = ?", id)
	})
}

func (m *agencyManager) consequencesNaming(ctx context.Context, tx *gorm.DB, k libraryKind, hazard models.Hazard) ([]string, error) {
	if k.role != roleHazard {
		return nil, nil
	}
	var codes []string
	err := tx.WithContext(ctx).Table(m.table(roleConsequence)).
		Where("draft_id = ? AND hazard_code = ? AND deleted = ?", hazard.DraftID, hazard.Code, false).
		Order("created_at").Pluck("code", &codes).Error
	return codes, err
}
