package http

import (
	"context"
	"slices"

	"wakalaserver/modules/shared/dispatch"
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
