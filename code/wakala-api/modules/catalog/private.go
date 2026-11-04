package mwanachamacatalog

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

func (m *catalogManager) privates(ctx context.Context) *gorm.DB {
	return m.q(ctx, roleEntryPrivate)
}

func (m *catalogManager) PutPrivate(ctx context.Context, p EntryPrivate) (EntryPrivate, error) {
	if err := m.checks(roleEntryPrivate, p); err != nil || p.Rank < 0 {
		return EntryPrivate{}, ErrInvalidPrivate
	}
	if _, err := m.findEntry(ctx, p.Slug); err != nil {
		return EntryPrivate{}, err
	}

	for {
		var existing EntryPrivate
		err := m.take(m.privates(ctx).Where("slug = ?", p.Slug), roleEntryPrivate, &existing, errNoPrivate)
		switch {
		case errors.Is(err, errNoPrivate):
			p.UpdatedAt = m.now()
			if err := m.insert(ctx, roleEntryPrivate, p); err != nil {
				if isUniqueViolation(err) {
					continue
				}
				return EntryPrivate{}, err
			}
			return p, nil
		case err != nil:
			return EntryPrivate{}, err
		}
		return m.mergePrivate(ctx, p)
	}
}

func (m *catalogManager) mergePrivate(ctx context.Context, p EntryPrivate) (EntryPrivate, error) {
	p.UpdatedAt = m.now()
	full, err := encode(m.st.Object(roleEntryPrivate), p)
	if err != nil {
		return EntryPrivate{}, err
	}
	updates := map[string]any{"updated_at": full["updated_at"]}
	for field, given := range map[string]bool{
		"readme":         p.Readme != "",
		"sales":          p.Sales != "",
		"module_configs": p.ModuleConfigs != "",
		"appeal":         p.Appeal != "",
		"rank":           p.Rank != 0 || p.ClearRank,
	} {
		if given {
			updates[field] = full[field]
		}
	}
	if err := m.privates(ctx).Where("slug = ?", p.Slug).Updates(updates).Error; err != nil {
		return EntryPrivate{}, err
	}
	var merged EntryPrivate
	if err := m.take(m.privates(ctx).Where("slug = ?", p.Slug), roleEntryPrivate, &merged, errNoPrivate); err != nil {
		return EntryPrivate{}, err
	}
	return merged, nil
}

func (m *catalogManager) GetPrivate(ctx context.Context, slug string) (EntryPrivate, error) {
	if _, err := m.findEntry(ctx, slug); err != nil {
		return EntryPrivate{}, err
	}

	var p EntryPrivate
	err := m.take(m.privates(ctx).Where("slug = ?", slug), roleEntryPrivate, &p, errNoPrivate)
	if errors.Is(err, errNoPrivate) {
		return EntryPrivate{Slug: slug}, nil
	}
	if err != nil {
		return EntryPrivate{}, err
	}
	return p, nil
}

var errNoPrivate = errors.New("catalog: no private parts stored")
