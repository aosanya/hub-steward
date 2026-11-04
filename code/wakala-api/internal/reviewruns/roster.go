package reviewruns

import "context"

const noReviewerSentence = "No reviewer is set up for this part yet."

type Roster struct {
	Reviewers   map[string]Reviewer
	Unavailable map[string]string
}

func (r Roster) reviewerFor(area string) (Reviewer, string) {
	if reviewer, ok := r.Reviewers[area]; ok && reviewer != nil {
		return reviewer, ""
	}
	if reason, ok := r.Unavailable[area]; ok && reason != "" {
		return nil, reason
	}
	return nil, noReviewerSentence
}

type ReviewerSource interface {
	For(ctx context.Context, instanceID string) (Roster, error)
}

type ReviewerSourceFunc func(ctx context.Context, instanceID string) (Roster, error)

func (f ReviewerSourceFunc) For(ctx context.Context, instanceID string) (Roster, error) {
	return f(ctx, instanceID)
}
