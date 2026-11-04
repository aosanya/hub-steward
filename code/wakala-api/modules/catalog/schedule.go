package mwanachamacatalog

import (
	"context"
	"fmt"

	"wakalaserver/modules/catalog/models"
)

func (m *catalogManager) SchedulePublish(ctx context.Context, slug, publishAt string) (Entry, error) {
	if _, err := m.SchedulePublishBatch(ctx, PublishSchedule{Slugs: []string{slug}, PublishAt: publishAt}); err != nil {
		return Entry{}, err
	}
	return m.GetEntry(ctx, slug)
}

func (m *catalogManager) SchedulePublishBatch(ctx context.Context, s PublishSchedule) ([]Entry, error) {
	if len(s.Slugs) == 0 {
		return nil, ErrInvalidEntry
	}
	at, ok := models.NormalizePublishAt(s.PublishAt)
	if !ok {
		return nil, ErrInvalidEntry
	}
	ids := make([]string, 0, len(s.Slugs))
	seen := map[string]bool{}
	for _, slug := range s.Slugs {
		if seen[slug] {
			continue
		}
		seen[slug] = true
		e, err := m.findEntry(ctx, slug)
		if err != nil {
			return nil, fmt.Errorf("%w: %s", err, slug)
		}
		ids = append(ids, e.ID)
	}
	updates := map[string]any{"publish_at": at, "updated_at": m.now()}
	if err := m.entries(ctx).Where("id IN ?", ids).Updates(updates).Error; err != nil {
		return nil, err
	}
	out := make([]Entry, 0, len(ids))
	for _, slug := range s.Slugs {
		if !seen[slug] {
			continue
		}
		seen[slug] = false
		e, err := m.GetEntry(ctx, slug)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, nil
}
