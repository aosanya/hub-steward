package mwanachamaagency

import (
	"context"
	"sort"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) coveringArea(ctx context.Context, tx *gorm.DB, fromReviewID string, area models.ReviewAreaName) (*models.ReviewArea, error) {
	seen := map[string]bool{}
	for id := fromReviewID; id != "" && !seen[id]; {
		seen[id] = true
		held, err := list[models.ReviewArea](m, tx.WithContext(ctx).Table(m.table(roleReviewArea)).
			Where("review_id = ? AND area = ?", id, string(area)), roleReviewArea)
		if err != nil {
			return nil, err
		}
		if len(held) > 0 {
			return &held[0], nil
		}
		review, err := m.findReview(ctx, tx, id)
		if err != nil {
			return nil, err
		}
		id = review.PreviousReviewID
	}
	return nil, nil
}

func (m *agencyManager) areaView(ctx context.Context, tx *gorm.DB, a models.ReviewArea) (models.ReviewAreaView, error) {
	findings, err := m.findingViews(ctx, tx, "area_id = ?", a.ID)
	if err != nil {
		return models.ReviewAreaView{}, err
	}
	return models.ReviewAreaView{ReviewArea: a, Findings: findings}, nil
}

func (m *agencyManager) latestPerArea(ctx context.Context, tx *gorm.DB, latest models.Review) (models.ReviewView, error) {
	view, err := m.reviewView(ctx, tx, latest)
	if err != nil {
		return models.ReviewView{}, err
	}
	held := map[models.ReviewAreaName]bool{}
	for _, a := range view.Areas {
		held[a.Area] = true
	}
	for _, name := range m.areasToRead(ctx, latest.DraftID) {
		if held[name] {
			continue
		}
		earlier, err := m.coveringArea(ctx, tx, latest.PreviousReviewID, name)
		if err != nil {
			return models.ReviewView{}, err
		}
		if earlier == nil {
			continue
		}
		carried, err := m.areaView(ctx, tx, *earlier)
		if err != nil {
			return models.ReviewView{}, err
		}
		view.Areas = append(view.Areas, carried)
	}
	sort.SliceStable(view.Areas, func(i, j int) bool { return areaRank(view.Areas[i].Area) < areaRank(view.Areas[j].Area) })
	return view, nil
}
