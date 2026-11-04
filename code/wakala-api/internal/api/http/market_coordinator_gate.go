package http

import (
	"context"

	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/agencies"
)

var coordinatorOnlyMarketActions = map[string]bool{
	"market.product.categorise": true,
	"market.offer.regroup":      true,
}

func coordinatorGated(role string, authorize dispatch.Authorizer) dispatch.Authorizer {
	if role == agencies.RoleOwner || role == agencies.RoleAgent {
		return authorize
	}
	return func(ctx context.Context, action string) error {
		if coordinatorOnlyMarketActions[action] {
			return dispatch.ErrForbidden
		}
		if authorize == nil {
			return nil
		}
		return authorize(ctx, action)
	}
}
