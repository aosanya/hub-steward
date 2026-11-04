package mwanachamaagency

import (
	"context"

	"wakalaserver/modules/agency/models"
)

type ReviewAreasFunc func(ctx context.Context, draftID string) []models.ReviewAreaName

func WithReviewAreas(areas ReviewAreasFunc) Option {
	return func(m *agencyManager) { m.reviewAreas = areas }
}

func AllReviewAreas(context.Context, string) []models.ReviewAreaName {
	return append([]models.ReviewAreaName(nil), models.ReviewAreaOrder...)
}

func (m *agencyManager) areasToRead(ctx context.Context, draftID string) []models.ReviewAreaName {
	if m.reviewAreas == nil {
		return AllReviewAreas(ctx, draftID)
	}
	return m.reviewAreas(ctx, draftID)
}

func areaRank(a models.ReviewAreaName) int {
	for i, known := range models.ReviewAreaOrder {
		if a == known {
			return i
		}
	}
	return len(models.ReviewAreaOrder)
}
