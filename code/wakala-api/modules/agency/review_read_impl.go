package mwanachamaagency

import (
	"context"
	"fmt"
	"sort"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func invalidReview(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidReview, fmt.Sprintf(format, args...))
}

func (m *agencyManager) findReview(ctx context.Context, tx *gorm.DB, id string) (models.Review, error) {
	var r models.Review
	if err := m.find(ctx, tx, roleReview, id, &r, ErrReviewNotFound); err != nil {
		return models.Review{}, err
	}
	return r, nil
}

func (m *agencyManager) latestReview(ctx context.Context, tx *gorm.DB, draftID string) (*models.Review, error) {
	q := tx.WithContext(ctx).Table(m.table(roleReview)).Where("draft_id = ?", draftID).Order("started_at desc").Limit(1)
	rows, err := list[models.Review](m, q, roleReview)
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return &rows[0], nil
}

func (m *agencyManager) reviewAreaRows(ctx context.Context, tx *gorm.DB, reviewID string) ([]models.ReviewArea, error) {
	rows, err := list[models.ReviewArea](m, tx.WithContext(ctx).Table(m.table(roleReviewArea)).Where("review_id = ?", reviewID), roleReviewArea)
	if err != nil {
		return nil, err
	}
	sort.SliceStable(rows, func(i, j int) bool { return areaRank(rows[i].Area) < areaRank(rows[j].Area) })
	return rows, nil
}

func (m *agencyManager) findingViews(ctx context.Context, tx *gorm.DB, where string, args ...any) ([]models.FindingView, error) {
	q := tx.WithContext(ctx).Table(m.table(roleReviewFinding)).Where(where, args...).Order("ordinal").Order("title").Order("id")
	findings, err := list[models.ReviewFinding](m, q, roleReviewFinding)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(findings))
	for _, f := range findings {
		ids = append(ids, f.ID)
	}
	comments, err := m.commentsByFinding(ctx, tx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]models.FindingView, 0, len(findings))
	for _, f := range findings {
		notes := comments[f.ID]
		if notes == nil {
			notes = []models.ReviewComment{}
		}
		out = append(out, models.FindingView{ReviewFinding: f, Comments: notes})
	}
	return out, nil
}

func (m *agencyManager) commentsByFinding(ctx context.Context, tx *gorm.DB, findingIDs []string) (map[string][]models.ReviewComment, error) {
	out := map[string][]models.ReviewComment{}
	if len(findingIDs) == 0 {
		return out, nil
	}
	q := tx.WithContext(ctx).Table(m.table(roleReviewComment)).Where("finding_id IN ?", findingIDs).Order("created_at").Order("id")
	rows, err := list[models.ReviewComment](m, q, roleReviewComment)
	if err != nil {
		return nil, err
	}
	for _, c := range rows {
		out[c.FindingID] = append(out[c.FindingID], c)
	}
	return out, nil
}

func (m *agencyManager) reviewView(ctx context.Context, tx *gorm.DB, r models.Review) (models.ReviewView, error) {
	areas, err := m.reviewAreaRows(ctx, tx, r.ID)
	if err != nil {
		return models.ReviewView{}, err
	}
	findings, err := m.findingViews(ctx, tx, "review_id = ?", r.ID)
	if err != nil {
		return models.ReviewView{}, err
	}
	byArea := map[string][]models.FindingView{}
	for _, f := range findings {
		byArea[f.AreaID] = append(byArea[f.AreaID], f)
	}
	views := make([]models.ReviewAreaView, 0, len(areas))
	for _, a := range areas {
		held := byArea[a.ID]
		if held == nil {
			held = []models.FindingView{}
		}
		views = append(views, models.ReviewAreaView{ReviewArea: a, Findings: held})
	}
	return models.ReviewView{Review: &r, Areas: views}, nil
}

func (m *agencyManager) GetReview(ctx context.Context, reviewID, draftID string) (models.ReviewView, error) {
	var out models.ReviewView
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		r, err := m.reviewToRead(ctx, tx, reviewID, draftID)
		if err != nil || r == nil {
			return err
		}
		if reviewID == "" {
			out, err = m.latestPerArea(ctx, tx, *r)
			return err
		}
		out, err = m.reviewView(ctx, tx, *r)
		return err
	})
	if err != nil {
		return models.ReviewView{}, fmt.Errorf("GetReview: %w", err)
	}
	return out, nil
}

func (m *agencyManager) reviewToRead(ctx context.Context, tx *gorm.DB, reviewID, draftID string) (*models.Review, error) {
	switch {
	case reviewID != "":
		r, err := m.findReview(ctx, tx, reviewID)
		if err != nil {
			return nil, err
		}
		if draftID != "" && r.DraftID != draftID {
			return nil, ErrReviewNotFound
		}
		return &r, nil
	case draftID != "":
		return m.latestReview(ctx, tx, draftID)
	default:
		return nil, invalidReview("a review id or a draft id is needed")
	}
}

func (m *agencyManager) ListReviews(ctx context.Context, draftID string) ([]models.Review, error) {
	if draftID == "" {
		return nil, ErrDraftRequired
	}
	q := m.q(ctx, roleReview).Where("draft_id = ?", draftID).Order("started_at desc")
	out, err := list[models.Review](m, q, roleReview)
	if err != nil {
		return nil, fmt.Errorf("ListReviews: %w", err)
	}
	return out, nil
}

func (m *agencyManager) ListRunningReviews(ctx context.Context, draftID string) ([]models.Review, error) {
	q := m.q(ctx, roleReview).Where("status = ?", string(models.ReviewRunning)).Order("started_at desc")
	if draftID != "" {
		q = q.Where("draft_id = ?", draftID)
	}
	out, err := list[models.Review](m, q, roleReview)
	if err != nil {
		return nil, fmt.Errorf("ListRunningReviews: %w", err)
	}
	return out, nil
}
