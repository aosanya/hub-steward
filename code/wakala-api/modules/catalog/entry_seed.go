package mwanachamacatalog

import (
	"context"
	"errors"
	"fmt"

	"wakalaserver/modules/catalog/models"
)

const seedsSetting = "seeds"

func (m *catalogManager) SeedEntries(ctx context.Context) ([]string, error) {
	seeds, err := m.entrySeeds(ctx)
	if err != nil {
		return nil, err
	}
	created := []string{}
	for _, s := range seeds {
		taken, err := m.slugEverUsed(ctx, s.Slug)
		if err != nil {
			return created, err
		}
		if taken {
			continue
		}
		_, err = m.CreateEntry(ctx, s.Entry())
		if errors.Is(err, ErrEntryExists) {
			continue
		}
		if err != nil {
			return created, fmt.Errorf("catalog: seed %s: %w", s.Slug, err)
		}
		created = append(created, s.Slug)
	}
	return created, nil
}

func (m *catalogManager) entrySeeds(ctx context.Context) ([]models.EntrySeed, error) {
	if _, declared := m.spec.Setting(seedsSetting); !declared {
		return nil, nil
	}
	return resolveFitting(ctx, m, seedsSetting, models.ParseEntrySeeds)
}

func (m *catalogManager) slugEverUsed(ctx context.Context, slug string) (bool, error) {
	var n int64
	err := m.entries(ctx).Where("slug = ?", slug).Count(&n).Error
	return n > 0, err
}
