package mwanachamainsights

import (
	"context"
	"fmt"

	"wakalaserver/modules/insights/models"
	"wakalaserver/modules/shared/specstore"
)

type InsightNote = models.InsightNote

func (m *insightManager) CreateInsightNote(ctx context.Context, in models.InsightNote) (models.InsightNote, error) {
	in.Source = m.defaulted(roleNote, "source", in.Source)
	if err := m.checks(roleNote, in, ErrInvalidInsightNote); err != nil {
		return models.InsightNote{}, err
	}
	if _, err := m.GetInsight(ctx, in.InsightID); err != nil {
		return models.InsightNote{}, err
	}

	in.ID = newID()
	in.CreatedAt = m.now()

	if err := m.st.Insert(ctx, roleNote, in); err != nil {
		return models.InsightNote{}, fmt.Errorf("CreateInsightNote: %w", err)
	}
	return in, nil
}

func (m *insightManager) ListInsightNotes(ctx context.Context, insightID string) ([]models.InsightNote, error) {
	q := m.st.Query(ctx, roleNote).Where("insight_id = ?", insightID)

	out, err := specstore.List[models.InsightNote](m.st, q.Order("created_at asc"), roleNote)
	if err != nil {
		return nil, fmt.Errorf("ListInsightNotes: %w", err)
	}
	return out, nil
}
