package mwanachamacatalog

import (
	"context"
	"time"
)

const scopeFigureListCap = 100

func (m *catalogManager) keepsFigures() bool {
	_, kept := m.st.Spec().ByRole(roleScopeFigure)
	return kept
}

func normalizedInstant(s string) (string, bool) {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return "", false
	}
	return t.UTC().Format(time.RFC3339), true
}

func (m *catalogManager) RecordScopeFigure(ctx context.Context, f ScopeFigure) (ScopeFigure, error) {
	if !m.keepsFigures() {
		return ScopeFigure{}, ErrFiguresNotKept
	}
	asOf, ok := normalizedInstant(f.AsOf)
	if !ok || f.Value < 0 {
		return ScopeFigure{}, ErrInvalidScopeFigure
	}
	f.AsOf = asOf
	if err := m.checks(roleScopeFigure, f); err != nil {
		return ScopeFigure{}, ErrInvalidScopeFigure
	}
	f.ID = newID()
	f.CreatedAt = m.now()
	row, err := encode(m.st.Object(roleScopeFigure), f)
	if err != nil {
		return ScopeFigure{}, err
	}
	if err := m.q(ctx, roleScopeFigure).Create(row).Error; err != nil {
		return ScopeFigure{}, err
	}
	return f, nil
}

func (m *catalogManager) CurrentScopeFigure(ctx context.Context, scopeID string) (ScopeFigure, error) {
	if !m.keepsFigures() {
		return ScopeFigure{}, ErrFiguresNotKept
	}
	if scopeID == "" {
		return ScopeFigure{}, ErrInvalidScopeFigure
	}
	var f ScopeFigure
	q := m.q(ctx, roleScopeFigure).Where("scope_id = ?", scopeID).Order("as_of DESC, created_at DESC, id DESC").Limit(1)
	return f, m.take(q, roleScopeFigure, &f, ErrScopeFigureNotFound)
}

func (m *catalogManager) ListScopeFigures(ctx context.Context, scopeID string) ([]ScopeFigure, error) {
	if !m.keepsFigures() {
		return nil, ErrFiguresNotKept
	}
	if scopeID == "" {
		return nil, ErrInvalidScopeFigure
	}
	return listOf[ScopeFigure](m, m.q(ctx, roleScopeFigure).Where("scope_id = ?", scopeID).Order("as_of DESC, created_at DESC, id DESC").Limit(scopeFigureListCap), roleScopeFigure)
}
