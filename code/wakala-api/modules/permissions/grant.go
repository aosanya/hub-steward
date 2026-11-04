package mwanachamapermissions

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/permissions/models"
)

func (m *manager) CreateGrant(ctx context.Context, g models.Grant) (models.Grant, error) {
	if g.Subject == "" || g.Scope == "" || g.RoleCode == "" {
		return models.Grant{}, ErrInvalidGrant
	}
	if !isScope(g.Scope) {
		return models.Grant{}, ErrInvalidScope
	}
	if !isPartition(g.Partition) {
		return models.Grant{}, ErrInvalidPartition
	}
	endsAt, err := normalEnd(g.EndsAt)
	if err != nil {
		return models.Grant{}, err
	}
	g.EndsAt = endsAt
	if _, err := m.findLiveRole(ctx, g.RoleCode); err != nil {
		return models.Grant{}, err
	}

	existing, err := m.findGrant(ctx, g.Subject, g.Partition, g.Scope, g.RoleCode)
	switch {
	case err == nil && !existing.Deleted:
		return models.Grant{}, ErrDuplicateGrant
	case err == nil:
		return m.reinstate(ctx, g)
	case !errors.Is(err, ErrGrantNotFound):
		return models.Grant{}, err
	}

	g.GrantedAt, g.Deleted = models.NowRFC3339(), false
	row, err := encode(m.object(roleGrant), g)
	if err != nil {
		return models.Grant{}, err
	}
	if err := m.query(ctx, roleGrant).Create(row).Error; err != nil {
		if isUniqueViolation(err) {
			return m.grantThatWonTheRace(ctx, g)
		}
		return models.Grant{}, fmt.Errorf("permissions: create grant: %w", classifyConflict(err))
	}
	return g, nil
}

func (m *manager) grantThatWonTheRace(ctx context.Context, g models.Grant) (models.Grant, error) {
	won, err := m.findGrant(ctx, g.Subject, g.Partition, g.Scope, g.RoleCode)
	if err != nil {
		return models.Grant{}, err
	}
	if won.Deleted {
		return m.reinstate(ctx, g)
	}
	return won, nil
}

func (m *manager) reinstate(ctx context.Context, g models.Grant) (models.Grant, error) {
	g.GrantedAt, g.Deleted = models.NowRFC3339(), false
	err := m.query(ctx, roleGrant).
		Where(keyOfGrant(), g.Subject, g.Partition, g.Scope, g.RoleCode).
		Updates(map[string]any{
			columnName("Deleted"):   false,
			columnName("GrantedAt"): g.GrantedAt,
			columnName("GrantedBy"): g.GrantedBy,
			columnName("EndsAt"):    g.EndsAt,
		}).Error
	if err != nil {
		return models.Grant{}, fmt.Errorf("permissions: reinstate grant: %w", err)
	}
	return g, nil
}

func keyOfGrant() string {
	return columnName("Subject") + " = ? and " +
		columnName("Partition") + " = ? and " +
		columnName("Scope") + " = ? and " +
		columnName("RoleCode") + " = ?"
}

func (m *manager) findGrant(ctx context.Context, subject, partition, scope, roleCode string) (models.Grant, error) {
	var row map[string]any
	err := m.query(ctx, roleGrant).
		Where(keyOfGrant(), subject, partition, scope, roleCode).
		Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Grant{}, ErrGrantNotFound
	}
	if err != nil {
		return models.Grant{}, fmt.Errorf("permissions: read grant: %w", err)
	}
	var out models.Grant
	if err := decode(m.object(roleGrant), row, &out); err != nil {
		return models.Grant{}, err
	}
	return out, nil
}

func (m *manager) ListGrants(ctx context.Context, f models.GrantFilter) ([]models.Grant, error) {
	q := m.query(ctx, roleGrant).Where(columnName("Deleted") + " = false")
	q = q.Where(stillRunning(""), "", endInstant(time.Now()))
	if f.Subject != "" {
		q = q.Where(columnName("Subject")+" = ?", f.Subject)
	}
	if f.Scope != "" {
		q = q.Where(columnName("Scope")+" = ?", f.Scope)
	}
	if f.Partition != "" {
		q = q.Where(columnName("Partition")+" = ?", f.Partition)
	}
	if f.RoleCode != "" {
		q = q.Where(columnName("RoleCode")+" = ?", f.RoleCode)
	}

	var rows []map[string]any
	err := q.Order(columnName("Subject") + ", " + columnName("Scope") + ", " + columnName("RoleCode")).
		Limit(listCap).Find(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("permissions: list grants: %w", err)
	}
	out := make([]models.Grant, 0, len(rows))
	for _, row := range rows {
		var g models.Grant
		if err := decode(m.object(roleGrant), row, &g); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, nil
}

func (m *manager) WithdrawGrant(ctx context.Context, subject, scope, roleCode string) error {
	return m.WithdrawGrantIn(ctx, subject, "", scope, roleCode)
}

func (m *manager) WithdrawGrantIn(ctx context.Context, subject, partition, scope, roleCode string) error {
	g, err := m.findGrant(ctx, subject, partition, scope, roleCode)
	if err != nil {
		return err
	}
	if g.Deleted {
		return nil
	}
	err = m.query(ctx, roleGrant).
		Where(keyOfGrant(), subject, partition, scope, roleCode).
		Update(columnName("Deleted"), true).Error
	if err != nil {
		return fmt.Errorf("permissions: withdraw grant: %w", err)
	}
	return nil
}

const endLayout = "2006-01-02T15:04:05.000000000Z"

func normalEnd(raw string) (string, error) {
	if raw == "" {
		return "", nil
	}
	t, err := time.Parse(time.RFC3339Nano, raw)
	if err != nil {
		return "", ErrInvalidEnd
	}
	if !t.After(time.Now()) {
		return "", ErrInvalidEnd
	}
	return endInstant(t), nil
}

func endInstant(t time.Time) string { return t.UTC().Format(endLayout) }

func stillRunning(alias string) string {
	col := alias + columnName("EndsAt")
	return "(" + col + " = ? or " + col + " > ?)"
}
