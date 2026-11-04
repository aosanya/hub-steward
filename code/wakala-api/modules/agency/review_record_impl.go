package mwanachamaagency

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) RecordReviewArea(ctx context.Context, reviewID string, area models.ReviewAreaName, status models.ReviewAreaStatus, summary, failureReason string, tokens int, findings []models.ReviewFindingInput) (models.ReviewAreaView, models.ReviewStatus, error) {
	var view models.ReviewAreaView
	var reviewStatus models.ReviewStatus
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := validateAreaReport(area, status, tokens); err != nil {
			return err
		}
		review, err := m.lockReview(ctx, tx, reviewID)
		if err != nil {
			return err
		}
		row, err := m.readingArea(ctx, tx, review.ID, area)
		if err != nil {
			return err
		}
		stored, err := m.carriedFindings(ctx, tx, review, row, findings)
		if err != nil {
			return err
		}
		for _, f := range stored {
			if err := m.insertRow(ctx, tx, roleReviewFinding, f); err != nil {
				return err
			}
		}
		row.Status, row.Summary, row.FailureReason, row.Tokens = status, strings.TrimSpace(summary), strings.TrimSpace(failureReason), tokens
		if err := m.writeUpdate(ctx, tx, roleReviewArea, row.ID, row, ErrReviewAreaNotFound, "review_id", "area"); err != nil {
			return err
		}
		review, err = m.settleReview(ctx, tx, review, tokens)
		if err != nil {
			return err
		}
		reviewStatus = review.Status
		views, err := m.findingViews(ctx, tx, "area_id = ?", row.ID)
		if err != nil {
			return err
		}
		view = models.ReviewAreaView{ReviewArea: row, Findings: views}
		return nil
	})
	if err != nil {
		return models.ReviewAreaView{}, "", fmt.Errorf("RecordReviewArea: %w", err)
	}
	return view, reviewStatus, nil
}

func validateAreaReport(area models.ReviewAreaName, status models.ReviewAreaStatus, tokens int) error {
	switch {
	case !area.Valid():
		return invalidReview("%q is not a part of a review", area)
	case status != models.ReviewAreaDone && status != models.ReviewAreaFailed:
		return invalidReview("a part is recorded done or failed, not %q", status)
	case tokens < 0:
		return invalidReview("tokens cannot be negative")
	}
	return nil
}

func (m *agencyManager) lockReview(ctx context.Context, tx *gorm.DB, id string) (models.Review, error) {
	var r models.Review
	q := tx.WithContext(ctx).Table(m.table(roleReview)).Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", id)
	if err := m.take(q, roleReview, &r, ErrReviewNotFound); err != nil {
		return models.Review{}, err
	}
	return r, nil
}

func (m *agencyManager) readingArea(ctx context.Context, tx *gorm.DB, reviewID string, area models.ReviewAreaName) (models.ReviewArea, error) {
	rows, err := list[models.ReviewArea](m, tx.WithContext(ctx).Table(m.table(roleReviewArea)).
		Where("review_id = ? AND area = ?", reviewID, string(area)), roleReviewArea)
	if err != nil {
		return models.ReviewArea{}, err
	}
	if len(rows) == 0 {
		return models.ReviewArea{}, ErrReviewAreaNotFound
	}
	if rows[0].Status != models.ReviewAreaReading {
		return models.ReviewArea{}, ErrReviewAreaRecorded
	}
	return rows[0], nil
}

func (m *agencyManager) settleReview(ctx context.Context, tx *gorm.DB, review models.Review, tokens int) (models.Review, error) {
	areas, err := m.reviewAreaRows(ctx, tx, review.ID)
	if err != nil {
		return review, err
	}
	review.Tokens += tokens
	if !anyReading(areas) {
		review.Status, review.Running, review.FinishedAt = settledStatus(areas), false, models.NowRFC3339()
	}
	err = m.writeUpdate(ctx, tx, roleReview, review.ID, review, ErrReviewNotFound,
		"draft_id", "previous_review_id", "started_by", "started_at")
	return review, err
}

func settledStatus(areas []models.ReviewArea) models.ReviewStatus {
	for _, a := range areas {
		if a.Status != models.ReviewAreaFailed {
			return models.ReviewDone
		}
	}
	return models.ReviewFailed
}

func anyReading(areas []models.ReviewArea) bool {
	for _, a := range areas {
		if a.Status == models.ReviewAreaReading {
			return true
		}
	}
	return false
}
