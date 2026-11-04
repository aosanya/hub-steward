package reviewruns

import (
	"context"
	"errors"
)

var (
	ErrAreaAlreadyRecorded = errors.New("This part of the review has already been recorded.")
	ErrReviewAlreadyRuns   = errors.New("A review of this draft is already running.")
)

type Tools interface {
	StartReview(ctx context.Context, instanceID, draftID, startedBy, area string) (Page, error)
	ReviewInput(ctx context.Context, instanceID, reviewID, area string) ([]PreviousFinding, error)
	RecordArea(ctx context.Context, instanceID string, args map[string]any) error
	RunningReviews(ctx context.Context) ([]Running, error)
}
