package http

import (
	"context"

	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/agencies"
)

const setCodeFormat = "actor.code_format.set"

func ownerOnlyActor(role string, authorize dispatch.Authorizer) dispatch.Authorizer {
	if role == agencies.RoleOwner {
		return authorize
	}
	return func(ctx context.Context, action string) error {
		if action == setCodeFormat {
			return dispatch.ErrForbidden
		}
		if authorize == nil {
			return nil
		}
		return authorize(ctx, action)
	}
}

var operatorOnlyActorActions = map[string]bool{
	"actor.invitation.check_batch": true,
	"actor.invitation.send_batch":  true,
}

func operatorOnlyActor(role string, authorize dispatch.Authorizer) dispatch.Authorizer {
	if role == agencies.RoleOwner || role == agencies.RoleAgent {
		return authorize
	}
	return func(ctx context.Context, action string) error {
		if operatorOnlyActorActions[action] {
			return dispatch.ErrForbidden
		}
		if authorize == nil {
			return nil
		}
		return authorize(ctx, action)
	}
}
