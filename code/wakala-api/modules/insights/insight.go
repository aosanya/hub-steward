package mwanachamainsights

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/insights/models"
	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"
)

type Insight = models.Insight

type InsightFilter struct {
	Repo      string `query:"repo"`
	SubjectID string `query:"subject_id"`
}

type InsightManager interface {
	CreateInsight(ctx context.Context, in models.Insight) (models.Insight, error)
	GetInsight(ctx context.Context, insightID string) (models.Insight, error)
	ListInsights(ctx context.Context, filter InsightFilter) ([]models.Insight, error)

	CreateInsightNote(ctx context.Context, in models.InsightNote) (models.InsightNote, error)
	ListInsightNotes(ctx context.Context, insightID string) ([]models.InsightNote, error)
}

type insightManager struct {
	db  *gorm.DB
	st  *store
	now func() string
}

func NewInsightManager(db *gorm.DB, s *spec.Spec) (InsightManager, error) {
	if db == nil {
		return nil, fmt.Errorf("NewInsightManager: db must not be nil")
	}
	st, err := newStore(db, s, map[string]any{
		roleInsight: models.Insight{},
		roleNote:    models.InsightNote{},
	})
	if err != nil {
		return nil, fmt.Errorf("NewInsightManager: %w", err)
	}
	return &insightManager{db: db, st: st, now: nowRFC3339}, nil
}

func nowRFC3339() string { return time.Now().UTC().Format(time.RFC3339) }

func (m *insightManager) CreateInsight(ctx context.Context, in models.Insight) (models.Insight, error) {
	in.Source = m.defaulted(roleInsight, "source", in.Source)
	if err := m.checks(roleInsight, in, ErrInvalidInsight); err != nil {
		return models.Insight{}, err
	}
	in.ID = newID()
	in.CreatedAt = m.now()

	if err := m.st.Insert(ctx, roleInsight, in); err != nil {
		return models.Insight{}, fmt.Errorf("CreateInsight: %w", err)
	}
	return in, nil
}

func (m *insightManager) GetInsight(ctx context.Context, insightID string) (models.Insight, error) {
	var out models.Insight
	q := m.st.Query(ctx, roleInsight).Where("id = ?", insightID)
	if err := m.st.Take(q, roleInsight, &out, ErrInsightNotFound); err != nil {
		return models.Insight{}, err
	}
	return out, nil
}

func (m *insightManager) ListInsights(ctx context.Context, filter InsightFilter) ([]models.Insight, error) {
	q := m.st.Query(ctx, roleInsight)
	if filter.Repo != "" {
		q = q.Where("repo = ?", filter.Repo)
	}
	if filter.SubjectID != "" {
		q = q.Where("subject_id = ?", filter.SubjectID)
	}

	out, err := specstore.List[models.Insight](m.st, q.Order("created_at desc"), roleInsight)
	if err != nil {
		return nil, fmt.Errorf("ListInsights: %w", err)
	}
	return out, nil
}
