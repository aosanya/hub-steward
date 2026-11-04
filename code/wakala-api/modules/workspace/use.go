package mwanachamaworkspace

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/workspace/models"
)

func (m *manager) Record(ctx context.Context, u models.Use) (models.Use, error) {
	if strings.TrimSpace(u.WorkbookID) == "" {
		return models.Use{}, ErrInvalidUse
	}
	if !isAction(u.Action) {
		return models.Use{}, ErrInvalidAction
	}
	if _, err := m.GetWorkbook(ctx, u.WorkbookID); err != nil {
		return models.Use{}, err
	}

	now := models.NowRFC3339()
	u.ID, u.At = newID(), now

	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		row, err := encode(m.object(roleUse), u)
		if err != nil {
			return err
		}
		if err := tx.Table(m.table(roleUse)).Create(row).Error; err != nil {
			return err
		}
		return m.bumpShortcut(ctx, tx, u, now)
	})
	if err != nil {
		return models.Use{}, fmt.Errorf("workspace: record use: %w", err)
	}
	return u, nil
}

func (m *manager) bumpShortcut(ctx context.Context, tx *gorm.DB, u models.Use, now string) error {
	table := m.table(roleShortcut)
	where := columnName("WorkbookID") + " = ? and " + columnName("Action") + " = ?"

	var held int64
	if err := tx.Table(table).Where(where, u.WorkbookID, u.Action).Count(&held).Error; err != nil {
		return err
	}
	if held > 0 {
		return tx.Table(table).Where(where, u.WorkbookID, u.Action).
			Updates(map[string]any{
				columnName("Uses"):     gorm.Expr(columnName("Uses") + " + 1"),
				columnName("LastUsed"): now,
			}).Error
	}

	s := models.Shortcut{
		WorkbookID: u.WorkbookID,
		Action:     u.Action,
		Label:      labelFor(u.Action),
		Uses:       1,
		LastUsed:   now,
	}
	row, err := encode(m.object(roleShortcut), s)
	if err != nil {
		return err
	}
	return tx.Table(table).Create(row).Error
}

func labelFor(action string) string {
	parts := strings.Split(action, ".")
	if len(parts) < 2 {
		return action
	}
	verb := strings.ReplaceAll(parts[len(parts)-1], "_", " ")
	noun := strings.ReplaceAll(parts[len(parts)-2], "_", " ")
	return strings.ToUpper(verb[:1]) + verb[1:] + " " + noun
}

func (m *manager) ListUses(ctx context.Context, workbookID string, f models.UseFilter) ([]models.Use, error) {
	q := m.query(ctx, roleUse).Where(columnName("WorkbookID")+" = ?", workbookID)
	if f.Action != "" {
		q = q.Where(columnName("Action")+" = ?", f.Action)
	}
	q = q.Order(columnName("At") + " desc")
	if f.Limit > 0 {
		q = q.Limit(f.Limit)
	}

	out := []models.Use{}
	err := m.rows(ctx, roleUse, q, func(row map[string]any) error {
		var u models.Use
		if err := decode(m.object(roleUse), row, &u); err != nil {
			return err
		}
		out = append(out, u)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("workspace: list uses: %w", err)
	}
	return out, nil
}

func (m *manager) ListShortcuts(ctx context.Context, workbookID string) ([]models.Shortcut, error) {
	q := m.query(ctx, roleShortcut).
		Where(columnName("WorkbookID")+" = ?", workbookID).
		Order(columnName("LastUsed") + " desc")

	out := []models.Shortcut{}
	err := m.rows(ctx, roleShortcut, q, func(row map[string]any) error {
		var s models.Shortcut
		if err := decode(m.object(roleShortcut), row, &s); err != nil {
			return err
		}
		out = append(out, s)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("workspace: list shortcuts: %w", err)
	}
	return out, nil
}
