package mwanachamaagency

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) findFinding(ctx context.Context, tx *gorm.DB, id string) (models.ReviewFinding, error) {
	var f models.ReviewFinding
	if err := m.find(ctx, tx, roleReviewFinding, id, &f, ErrFindingNotFound); err != nil {
		return models.ReviewFinding{}, err
	}
	return f, nil
}

func (m *agencyManager) SetFindingStatus(ctx context.Context, findingID string, status models.FindingStatus) (models.FindingView, error) {
	var out models.FindingView
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if !status.Valid() {
			return invalidReview("a finding is open, applied or dismissed, not %q", status)
		}
		if _, err := m.findFinding(ctx, tx, findingID); err != nil {
			return err
		}
		res := tx.WithContext(ctx).Table(m.table(roleReviewFinding)).Where("id = ?", findingID).Update("status", string(status))
		if res.Error != nil {
			return res.Error
		}
		views, err := m.findingViews(ctx, tx, "id = ?", findingID)
		if err != nil {
			return err
		}
		out = views[0]
		return nil
	})
	if err != nil {
		return models.FindingView{}, fmt.Errorf("SetFindingStatus: %w", err)
	}
	return out, nil
}

func (m *agencyManager) CommentFinding(ctx context.Context, findingID, body, author string) (models.ReviewComment, error) {
	var out models.ReviewComment
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		body = strings.TrimSpace(body)
		if body == "" {
			return invalidReview("a comment has some text")
		}
		if _, err := m.findFinding(ctx, tx, findingID); err != nil {
			return err
		}
		out = models.ReviewComment{
			ID: newID(), FindingID: findingID, Author: strings.TrimSpace(author), Body: body, CreatedAt: models.NowRFC3339(),
		}
		return m.insertRow(ctx, tx, roleReviewComment, out)
	})
	if err != nil {
		return models.ReviewComment{}, fmt.Errorf("CommentFinding: %w", err)
	}
	return out, nil
}

func (m *agencyManager) ReviewInput(ctx context.Context, reviewID string, area models.ReviewAreaName) (models.ReviewInput, error) {
	out := models.ReviewInput{Previous: []models.FindingView{}}
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if !area.Valid() {
			return invalidReview("%q is not a part of a review", area)
		}
		review, err := m.findReview(ctx, tx, reviewID)
		if err != nil || review.PreviousReviewID == "" {
			return err
		}
		earlier, err := m.coveringArea(ctx, tx, review.PreviousReviewID, area)
		if err != nil || earlier == nil {
			return err
		}
		out.Previous, err = m.findingViews(ctx, tx, "area_id = ?", earlier.ID)
		return err
	})
	if err != nil {
		return models.ReviewInput{}, fmt.Errorf("ReviewInput: %w", err)
	}
	return out, nil
}
