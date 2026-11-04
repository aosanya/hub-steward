package mwanachamaworkspace

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/workspace/models"
)

func (m *manager) Touch(ctx context.Context, r models.Reference) (models.Reference, error) {
	if strings.TrimSpace(r.WorkbookID) == "" ||
		strings.TrimSpace(r.Module) == "" ||
		strings.TrimSpace(r.Label) == "" {
		return models.Reference{}, ErrInvalidReference
	}
	if _, err := m.GetWorkbook(ctx, r.WorkbookID); err != nil {
		return models.Reference{}, err
	}

	now := models.NowRFC3339()
	existing, err := m.findReference(ctx, r.WorkbookID, r.Module, r.Item)
	switch {
	case err == nil:
		existing.Label, existing.LastSeen, existing.Deleted = r.Label, now, false
		err = m.query(ctx, roleReference).
			Where(columnName("ID")+" = ?", existing.ID).
			Updates(map[string]any{
				columnName("Label"):    existing.Label,
				columnName("LastSeen"): existing.LastSeen,
				columnName("Deleted"):  false,
			}).Error
		if err != nil {
			return models.Reference{}, fmt.Errorf("workspace: touch reference: %w", err)
		}
		return existing, nil
	case !errors.Is(err, ErrReferenceNotFound):
		return models.Reference{}, err
	}

	r.ID, r.FirstSeen, r.LastSeen, r.Deleted = newID(), now, now, false
	row, err := encode(m.object(roleReference), r)
	if err != nil {
		return models.Reference{}, err
	}
	if err := m.query(ctx, roleReference).Create(row).Error; err != nil {
		return models.Reference{}, fmt.Errorf("workspace: touch reference: %w", err)
	}
	return r, nil
}

func (m *manager) findReference(ctx context.Context, workbookID, module, item string) (models.Reference, error) {
	var row map[string]any
	err := m.query(ctx, roleReference).
		Where(columnName("WorkbookID")+" = ? and "+columnName("Module")+" = ? and "+columnName("Item")+" = ?",
			workbookID, module, item).
		Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Reference{}, ErrReferenceNotFound
	}
	if err != nil {
		return models.Reference{}, fmt.Errorf("workspace: read reference: %w", err)
	}
	var out models.Reference
	if err := decode(m.object(roleReference), row, &out); err != nil {
		return models.Reference{}, err
	}
	return out, nil
}

func (m *manager) ListReferences(ctx context.Context, workbookID string, f models.ReferenceFilter) ([]models.Reference, error) {
	q := m.query(ctx, roleReference).
		Where(columnName("WorkbookID")+" = ?", workbookID).
		Where(columnName("Deleted") + " = false")
	if f.Module != "" {
		q = q.Where(columnName("Module")+" = ?", f.Module)
	}
	if f.Item != "" {
		q = q.Where(columnName("Item")+" = ?", f.Item)
	}

	out := []models.Reference{}
	err := m.rows(ctx, roleReference, q.Order(columnName("LastSeen")+" desc"), func(row map[string]any) error {
		var r models.Reference
		if err := decode(m.object(roleReference), row, &r); err != nil {
			return err
		}
		out = append(out, r)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("workspace: list references: %w", err)
	}
	return out, nil
}

func (m *manager) DropReference(ctx context.Context, referenceID string) error {
	err := m.query(ctx, roleReference).
		Where(columnName("ID")+" = ?", referenceID).
		Update(columnName("Deleted"), true).Error
	if err != nil {
		return fmt.Errorf("workspace: drop reference: %w", err)
	}
	return nil
}
