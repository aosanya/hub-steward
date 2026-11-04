package mwanachamacatalog

import (
	"context"
	"time"
)

func (m *catalogManager) DisposeExpired(ctx context.Context, now time.Time) ([]string, error) {
	at := now.UTC().Format(time.RFC3339)
	var due []struct {
		ID   string
		Slug string
	}
	if err := m.entries(ctx).
		Select("id", "slug").
		Where("deleted = ? AND dispose_at <> '' AND dispose_at <= ?", false, at).
		Order("slug").
		Find(&due).Error; err != nil {
		return nil, err
	}

	disposed := make([]string, 0, len(due))
	for _, d := range due {
		res := m.entries(ctx).
			Where("id = ? AND deleted = ? AND dispose_at <> '' AND dispose_at <= ?", d.ID, false, at).
			Updates(map[string]any{"deleted": true, "updated_at": at})
		if res.Error != nil {
			return disposed, res.Error
		}
		if res.RowsAffected == 0 {
			continue
		}
		if err := m.retireLinksFor(ctx, d.Slug, at); err != nil {
			return disposed, err
		}
		disposed = append(disposed, d.Slug)
	}
	return disposed, nil
}
