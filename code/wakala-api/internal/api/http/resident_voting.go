package http

import (
	"context"
	"slices"

	"wakalaserver/modules/shared/dispatch"
	mwanachamavoting "wakalaserver/modules/voting"

	"wakalaserver/internal/accounts"
)

var residentVotingActions = []string{
	"voting.poll.read",
	"voting.choice.list",
	"voting.answer.create",
	"voting.response.read_own",
	"voting.result.read",
}

func authorizeResidentVoting(_ context.Context, action string) error {
	if slices.Contains(residentVotingActions, action) {
		return nil
	}
	return dispatch.ErrForbidden
}

type residentPolls struct {
	mwanachamavoting.PollManager
}

func (r residentPolls) ShowPoll(ctx context.Context, pollID string) (mwanachamavoting.PollRead, error) {
	if err := r.OpenToReader(ctx, pollID, accounts.IDFromContext(ctx)); err != nil {
		return nil, err
	}
	p, err := r.GetPoll(ctx, pollID)
	if err != nil {
		return nil, err
	}
	return p.RespondentView(), nil
}

func (r residentPolls) ListChoices(ctx context.Context, pollID string) ([]mwanachamavoting.Choice, error) {
	if err := r.OpenToReader(ctx, pollID, accounts.IDFromContext(ctx)); err != nil {
		return nil, err
	}
	return r.PollManager.ListChoices(ctx, pollID)
}
