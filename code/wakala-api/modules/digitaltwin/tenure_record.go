package digitaltwin

import (
	"context"
	"errors"
	"fmt"
	"time"
)

func (m *twinManager) CreateTenure(ctx context.Context, t Tenure) (Tenure, error) {
	if t.Kind == "" {
		t.Kind = "owner"
	}
	if err := m.checks(roleTenure, t); err != nil {
		return Tenure{}, err
	}
	if _, err := m.GetNode(ctx, t.PlaceID); err != nil {
		if errors.Is(err, ErrNodeNotFound) {
			return Tenure{}, fmt.Errorf("%w: place_id %q names no node", ErrInvalid, t.PlaceID)
		}
		return Tenure{}, err
	}
	if t.Since != "" && !isDate(t.Since) {
		return Tenure{}, fmt.Errorf("%w: since must be RFC3339 or YYYY-MM-DD (%q given)", ErrInvalid, t.Since)
	}
	t.ID = newID()
	t.CreatedAt = m.now()
	if err := m.insert(ctx, roleTenure, t); err != nil {
		return Tenure{}, err
	}
	return t, nil
}

func (m *twinManager) GetTenure(ctx context.Context, id string) (Tenure, error) {
	var out Tenure
	err := m.take(m.q(ctx, roleTenure).Where("id = ?", id), roleTenure, &out, ErrTenureNotFound)
	return out, err
}

func (m *twinManager) ListTenures(ctx context.Context, filter TenureFilter) ([]Tenure, error) {
	q := m.q(ctx, roleTenure)
	if filter.PlaceID != "" {
		q = q.Where("place_id = ?", filter.PlaceID)
	}
	if filter.Holder != "" {
		q = q.Where("holder = ?", filter.Holder)
	}
	if filter.Kind != "" {
		q = q.Where("kind = ?", filter.Kind)
	}
	return listOf[Tenure](m, q.Order("created_at").Limit(capped(filter.Limit)), roleTenure)
}

func isDate(s string) bool {
	if _, err := time.Parse(time.RFC3339, s); err == nil {
		return true
	}
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}
