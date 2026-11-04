package mwanachamaagency

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) StartReview(ctx context.Context, draftID, startedBy, area string) (models.ReviewView, error) {
	var out models.ReviewView
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := m.requireOpenDraft(ctx, tx, draftID); err != nil {
			return err
		}
		names, err := m.areasForRun(ctx, draftID, area)
		if err != nil {
			return err
		}
		running, err := m.runningReviews(ctx, tx, draftID)
		if err != nil {
			return err
		}
		if running > 0 {
			return ErrReviewRunning
		}
		latest, err := m.latestReview(ctx, tx, draftID)
		if err != nil {
			return err
		}
		review := models.Review{
			ID: newID(), DraftID: draftID, Status: models.ReviewRunning, Running: true,
			StartedBy: strings.TrimSpace(startedBy), StartedAt: models.NowRFC3339(),
		}
		if latest != nil {
			review.PreviousReviewID = latest.ID
		}
		if err := m.insertRow(ctx, tx, roleReview, review); err != nil {
			return duplicateOr(err, ErrReviewRunning)
		}
		for _, name := range names {
			area := models.ReviewArea{ID: newID(), ReviewID: review.ID, Area: name, Status: models.ReviewAreaReading}
			if err := m.insertRow(ctx, tx, roleReviewArea, area); err != nil {
				return err
			}
		}
		out, err = m.reviewView(ctx, tx, review)
		return err
	})
	if errors.Is(err, ErrReviewRunning) {
		return models.ReviewView{}, ErrReviewRunning
	}
	if errors.Is(err, ErrNoReviewAreas) {
		return models.ReviewView{}, ErrNoReviewAreas
	}
	if err != nil {
		return models.ReviewView{}, fmt.Errorf("StartReview: %w", err)
	}
	return out, nil
}

func (m *agencyManager) areasForRun(ctx context.Context, draftID, area string) ([]models.ReviewAreaName, error) {
	available := m.areasToRead(ctx, draftID)
	if strings.TrimSpace(area) == "" {
		if len(available) == 0 {
			return nil, ErrNoReviewAreas
		}
		return available, nil
	}
	name := models.ReviewAreaName(strings.TrimSpace(area))
	if !name.Valid() {
		return nil, invalidReview("%q is not a part of a review", area)
	}
	for _, known := range available {
		if known == name {
			return []models.ReviewAreaName{name}, nil
		}
	}
	return nil, invalidReview("%q is not read for this draft", area)
}

func (m *agencyManager) runningReviews(ctx context.Context, tx *gorm.DB, draftID string) (int, error) {
	q := tx.WithContext(ctx).Table(m.table(roleReview)).Where("draft_id = ? AND status = ?", draftID, string(models.ReviewRunning))
	rows, err := list[models.Review](m, q, roleReview)
	return len(rows), err
}
