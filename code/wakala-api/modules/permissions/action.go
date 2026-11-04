package mwanachamapermissions

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/permissions/models"
)

func lower(s string) string { return strings.ToLower(s) }

func (m *manager) AddAction(ctx context.Context, roleCode, action string) (models.RoleAction, error) {
	role, err := m.findLiveRole(ctx, roleCode)
	if err != nil {
		return models.RoleAction{}, err
	}
	if role.Seeded {
		return models.RoleAction{}, ErrSeededRole
	}
	if !isAction(action) {
		return models.RoleAction{}, ErrInvalidAction
	}

	ra := models.RoleAction{RoleCode: roleCode, Action: action, CreatedAt: models.NowRFC3339()}
	if err := m.writeAction(ctx, m.db, ra); err != nil {
		return models.RoleAction{}, err
	}
	return ra, nil
}

func (m *manager) writeAction(ctx context.Context, db *gorm.DB, ra models.RoleAction) error {
	row, err := encode(m.object(roleRoleAction), ra)
	if err != nil {
		return err
	}
	table := db.WithContext(ctx).Table(m.table(roleRoleAction))

	var held int64
	err = table.
		Where(columnName("RoleCode")+" = ? and "+columnName("Action")+" = ?", ra.RoleCode, ra.Action).
		Count(&held).Error
	if err != nil {
		return fmt.Errorf("permissions: add action: %w", err)
	}
	if held > 0 {
		return nil
	}
	if err := db.WithContext(ctx).Table(m.table(roleRoleAction)).Create(row).Error; err != nil {
		if isUniqueViolation(err) {
			return nil
		}
		return fmt.Errorf("permissions: add action: %w", classifyConflict(err))
	}
	return nil
}

func (m *manager) RemoveAction(ctx context.Context, roleCode, action string) error {
	role, err := m.findRole(ctx, roleCode)
	if err != nil {
		return err
	}
	if role.Seeded {
		return ErrSeededRole
	}
	err = m.query(ctx, roleRoleAction).
		Where(columnName("RoleCode")+" = ? and "+columnName("Action")+" = ?", roleCode, action).
		Delete(nil).Error
	if err != nil {
		return fmt.Errorf("permissions: remove action: %w", err)
	}
	return nil
}

func (m *manager) ListActions(ctx context.Context, roleCode string) ([]models.RoleAction, error) {
	var rows []map[string]any
	err := m.query(ctx, roleRoleAction).
		Where(columnName("RoleCode")+" = ?", roleCode).
		Order(columnName("Action")).
		Limit(listCap).Find(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("permissions: list actions: %w", err)
	}
	out := make([]models.RoleAction, 0, len(rows))
	for _, row := range rows {
		var ra models.RoleAction
		if err := decode(m.object(roleRoleAction), row, &ra); err != nil {
			return nil, err
		}
		out = append(out, ra)
	}
	return out, nil
}

func (m *manager) SetActions(ctx context.Context, roleCode string, actions []string) ([]models.RoleAction, error) {
	if actions == nil {
		return nil, ErrActionsRequired
	}
	return m.replaceActions(ctx, roleCode, actions, false)
}

func (m *manager) SeedActions(ctx context.Context, roleCode string, actions []string) ([]models.RoleAction, error) {
	return m.replaceActions(ctx, roleCode, actions, true)
}

func (m *manager) replaceActions(ctx context.Context, roleCode string, actions []string, seeding bool) ([]models.RoleAction, error) {
	if _, err := m.findRole(ctx, roleCode); err != nil {
		return nil, err
	}
	for _, a := range actions {
		if !isAction(a) {
			return nil, fmt.Errorf("%w: %q", ErrInvalidAction, a)
		}
	}

	actions = distinct(actions)
	now := models.NowRFC3339()
	out := make([]models.RoleAction, 0, len(actions))

	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := tx.Table(m.table(roleRoleAction)).
			Where(columnName("RoleCode")+" = ?", roleCode).
			Delete(nil).Error
		if err != nil {
			return fmt.Errorf("permissions: clear actions: %w", err)
		}
		for _, a := range actions {
			ra := models.RoleAction{RoleCode: roleCode, Action: a, CreatedAt: now}
			row, err := encode(m.object(roleRoleAction), ra)
			if err != nil {
				return err
			}
			if err := tx.Table(m.table(roleRoleAction)).Create(row).Error; err != nil {
				return fmt.Errorf("permissions: set actions: %w", classifyConflict(err))
			}
			out = append(out, ra)
		}
		changed := map[string]any{columnName("UpdatedAt"): now}
		if seeding {
			changed[columnName("Seeded")] = true
		}
		return tx.Table(m.table(roleRole)).
			Where(columnName("Code")+" = ?", roleCode).
			Updates(changed).Error
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

func distinct(actions []string) []string {
	seen := make(map[string]bool, len(actions))
	out := make([]string, 0, len(actions))
	for _, a := range actions {
		if !seen[a] {
			seen[a] = true
			out = append(out, a)
		}
	}
	return out
}
