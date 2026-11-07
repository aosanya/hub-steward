package http

import (
	"context"
	"errors"

	mwanachamainsights "wakalaserver/modules/insights"
	"wakalaserver/modules/insights/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type membershipScopedInsights struct {
	inner mwanachamainsights.InsightManager
	reg   agencies.Registry
}

func scopeInsightsToCaller(im mwanachamainsights.InsightManager, reg agencies.Registry) mwanachamainsights.InsightManager {
	if im == nil || reg == nil {
		return im
	}
	return &membershipScopedInsights{inner: im, reg: reg}
}

func (s *membershipScopedInsights) CreateInsight(ctx context.Context, in models.Insight) (models.Insight, error) {
	if err := mustBeMember(ctx, s.reg, in.SubjectID); err != nil {
		return models.Insight{}, err
	}
	return s.inner.CreateInsight(ctx, in)
}

func (s *membershipScopedInsights) GetInsight(ctx context.Context, insightID string) (models.Insight, error) {
	in, err := s.inner.GetInsight(ctx, insightID)
	if err != nil {
		return models.Insight{}, err
	}
	if err := mustBeMember(ctx, s.reg, in.SubjectID); err != nil {
		if errors.Is(err, agencies.ErrInstanceNotFound) {
			return models.Insight{}, mwanachamainsights.ErrInsightNotFound
		}
		return models.Insight{}, err
	}
	return in, nil
}

func (s *membershipScopedInsights) ListInsights(ctx context.Context, filter mwanachamainsights.InsightFilter) ([]models.Insight, error) {
	if filter.SubjectID != "" {
		if err := mustBeMember(ctx, s.reg, filter.SubjectID); err != nil {
			return nil, err
		}
		return s.inner.ListInsights(ctx, filter)
	}

	reachable, err := s.reachableAgencies(ctx)
	if err != nil {
		return nil, err
	}
	out := []models.Insight{}
	for _, agencyID := range reachable {
		scoped := filter
		scoped.SubjectID = agencyID
		found, err := s.inner.ListInsights(ctx, scoped)
		if err != nil {
			return nil, err
		}
		out = append(out, found...)
	}
	return out, nil
}

func (s *membershipScopedInsights) CountInsightsBySubject(ctx context.Context) (mwanachamainsights.SubjectCounts, error) {
	minimum, err := s.inner.MinimumCount(ctx)
	if err != nil {
		return mwanachamainsights.SubjectCounts{}, err
	}
	return mwanachamainsights.CountBySubject(ctx, s, minimum)
}

func (s *membershipScopedInsights) MinimumCount(ctx context.Context) (int, error) {
	return s.inner.MinimumCount(ctx)
}

func (s *membershipScopedInsights) UseSettings(layers mwanachamainsights.SettingsLayers) {
	s.inner.UseSettings(layers)
}

func (s *membershipScopedInsights) CreateInsightNote(ctx context.Context, in models.InsightNote) (models.InsightNote, error) {
	if _, err := s.GetInsight(ctx, in.InsightID); err != nil {
		return models.InsightNote{}, err
	}
	return s.inner.CreateInsightNote(ctx, in)
}

func (s *membershipScopedInsights) ListInsightNotes(ctx context.Context, insightID string) ([]models.InsightNote, error) {
	if _, err := s.GetInsight(ctx, insightID); err != nil {
		return nil, err
	}
	return s.inner.ListInsightNotes(ctx, insightID)
}

func (s *membershipScopedInsights) reachableAgencies(ctx context.Context) ([]string, error) {
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return nil, agencies.ErrInstanceNotFound
	}
	instances, err := s.reg.InstancesFor(ctx, caller)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(instances))
	for _, instance := range instances {
		ids = append(ids, instance.ID)
	}
	return ids, nil
}
