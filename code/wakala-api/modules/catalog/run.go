package mwanachamacatalog

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/catalog/models"
)

func (m *catalogManager) runs(ctx context.Context) *gorm.DB {
	return m.q(ctx, roleRun)
}

func (m *catalogManager) settings(ctx context.Context) *gorm.DB {
	return m.q(ctx, roleSetting)
}

func (m *catalogManager) views(ctx context.Context) *gorm.DB {
	return m.q(ctx, rolePageView)
}

func (m *catalogManager) RecordRun(ctx context.Context, r MiningRun) (MiningRun, error) {
	if err := m.needs(roleRun); err != nil {
		return MiningRun{}, err
	}
	if r.TemplatesFiled < 0 || len(r.Summary) > models.MaxRunSummaryBytes {
		return MiningRun{}, ErrInvalidRun
	}
	r.ID = newID()
	r.CreatedAt = m.now()
	if err := m.insert(ctx, roleRun, r); err != nil {
		return MiningRun{}, err
	}
	return r, nil
}

func (m *catalogManager) ListRuns(ctx context.Context, limit int) ([]MiningRun, error) {
	if err := m.needs(roleRun); err != nil {
		return nil, err
	}
	if limit <= 0 {
		limit = models.DefaultRunLimit
	}
	limit = min(limit, models.MaxRunLimit)
	q := m.runs(ctx).Order("created_at DESC, id DESC").Limit(limit)
	return listOf[MiningRun](m, q, roleRun)
}

func (m *catalogManager) PutSetting(ctx context.Context, key, value string) (Setting, error) {
	if err := m.needs(roleSetting); err != nil {
		return Setting{}, err
	}
	if key == "" {
		return Setting{}, ErrInvalidSetting
	}
	s := models.Setting{Key: key, Value: value, UpdatedAt: m.now()}

	for {
		if err := m.insert(ctx, roleSetting, s); err == nil {
			return s, nil
		} else if !isUniqueViolation(err) {
			return Setting{}, err
		}
		result := m.settings(ctx).Where("key = ?", key).
			Updates(map[string]any{"value": value, "updated_at": s.UpdatedAt})
		if result.Error != nil {
			return Setting{}, result.Error
		}
		if result.RowsAffected > 0 {
			return s, nil
		}
	}
}

func (m *catalogManager) GetSetting(ctx context.Context, key string) (Setting, error) {
	if err := m.needs(roleSetting); err != nil {
		return Setting{}, fmt.Errorf("%w: %w", err, ErrSettingNotFound)
	}
	var s Setting
	err := m.take(m.settings(ctx).Where("key = ?", key), roleSetting, &s, ErrSettingNotFound)
	if err != nil {
		return Setting{}, err
	}
	return s, nil
}

func (m *catalogManager) RecordPageView(ctx context.Context, page PageKind, slug string) error {
	if err := m.needs(rolePageView); err != nil {
		return err
	}
	if page == models.PageKindIndex {
		slug = ""
	}
	v := models.PageView{Page: page, Slug: slug}
	if err := m.checks(rolePageView, v); err != nil || !v.SlugFitsPage() {
		return ErrInvalidPageView
	}
	if page == models.PageKindEntry {
		if _, err := m.OpenEntry(ctx, slug, ""); err != nil {
			return err
		}
	}

	res := m.views(ctx).Where("page = ? AND slug = ?", string(page), slug).
		UpdateColumn("views", gorm.Expr("views + 1"))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected > 0 {
		return nil
	}
	if err := m.insert(ctx, rolePageView, models.PageView{Page: page, Slug: slug, Views: 1}); err != nil {
		// Another caller created the row between the update and here; the
		// increment is theirs to have made, so retry it rather than fail.
		if isUniqueViolation(err) {
			return m.views(ctx).Where("page = ? AND slug = ?", string(page), slug).
				UpdateColumn("views", gorm.Expr("views + 1")).Error
		}
		return err
	}
	return nil
}

func (m *catalogManager) ListPageViews(ctx context.Context) ([]PageView, error) {
	if err := m.needs(rolePageView); err != nil {
		return nil, err
	}
	return listOf[PageView](m, m.views(ctx).Order("views DESC, page, slug"), rolePageView)
}
