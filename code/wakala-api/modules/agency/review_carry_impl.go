package mwanachamaagency

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) carriedFindings(ctx context.Context, tx *gorm.DB, review models.Review, area models.ReviewArea, in []models.ReviewFindingInput) ([]models.ReviewFinding, error) {
	out := make([]models.ReviewFinding, 0, len(in))
	at := map[string]int{}
	for i, f := range in {
		earlier, err := m.earlierFinding(ctx, tx, review, area.Area, f.CarriedFromID)
		if err != nil {
			return nil, invalidReview("finding %d: %v", i+1, err)
		}
		stored, err := storedFinding(review, area, f, earlier)
		if err != nil {
			return nil, invalidReview("finding %d: %v", i+1, err)
		}
		key := strings.ToLower(strings.Join(strings.Fields(stored.Title), " "))
		if held, again := at[key]; again {
			if out[held].Status != models.FindingOpen && stored.Status == models.FindingOpen {
				out[held] = stored
			}
			continue
		}
		at[key] = len(out)
		out = append(out, stored)
	}
	for i := range out {
		out[i].Ordinal = i + 1
	}
	return out, nil
}

func (m *agencyManager) earlierFinding(ctx context.Context, tx *gorm.DB, review models.Review, area models.ReviewAreaName, id string) (*models.ReviewFinding, error) {
	if id == "" {
		return nil, nil
	}
	f, err := m.findFinding(ctx, tx, id)
	if err != nil {
		return nil, err
	}
	earlier, err := m.coveringArea(ctx, tx, review.PreviousReviewID, area)
	if err != nil {
		return nil, err
	}
	if earlier == nil || f.AreaID != earlier.ID {
		return nil, errNotInPreviousReview
	}
	return &f, nil
}

var errNotInPreviousReview = errors.New("carried_from_id names a finding that is not in the previous review")

func storedFinding(review models.Review, area models.ReviewArea, f models.ReviewFindingInput, earlier *models.ReviewFinding) (models.ReviewFinding, error) {
	title := strings.TrimSpace(f.Title)
	if title == "" {
		return models.ReviewFinding{}, errors.New("a finding has a title")
	}
	fate, err := fateOf(f, earlier)
	if err != nil {
		return models.ReviewFinding{}, err
	}
	if err := checkSteps(f.ThenSteps); err != nil {
		return models.ReviewFinding{}, err
	}
	return models.ReviewFinding{
		ID: newID(), ReviewID: review.ID, AreaID: area.ID, Title: title, Detail: strings.TrimSpace(f.Detail),
		Tool: strings.TrimSpace(f.Tool), Arguments: f.Arguments, ThenSteps: f.ThenSteps,
		Status: carriedStatus(earlier, fate, f.Reopen), Fate: fate, FateReason: strings.TrimSpace(f.FateReason),
		CarriedFromID: f.CarriedFromID,
	}, nil
}

func fateOf(f models.ReviewFindingInput, earlier *models.ReviewFinding) (models.FindingFate, error) {
	fate := f.Fate
	if fate == "" && earlier == nil {
		fate = models.FateNew
	}
	if !fate.Valid() {
		return "", errors.New("a finding's fate is new, fixed, still_open or withdrawn")
	}
	if earlier != nil && fate == models.FateNew {
		return "", errors.New("a finding that answers an earlier one says whether it is fixed, still_open or withdrawn")
	}
	return fate, nil
}

func checkSteps(steps []models.FindingStep) error {
	for _, s := range steps {
		if strings.TrimSpace(s.Tool) == "" {
			return errors.New("every step in then names a tool")
		}
	}
	return nil
}

func carriedStatus(earlier *models.ReviewFinding, fate models.FindingFate, reopen bool) models.FindingStatus {
	if earlier == nil {
		return models.FindingOpen
	}
	switch {
	case earlier.Status == models.FindingApplied && fate == models.FateStillOpen:
		return models.FindingOpen
	case earlier.Status == models.FindingDismissed && reopen:
		return models.FindingOpen
	}
	return earlier.Status
}
