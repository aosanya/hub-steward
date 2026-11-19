package http

import (
	"context"
	"errors"
	"slices"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

func PaymentListHolders(regOf func() agencies.Registry) agencies.HoldsPermission {
	return func(ctx context.Context, instanceID, actorID string) (bool, error) {
		reg := regOf()
		membership, err := reg.RoleOf(ctx, instanceID, actorID)
		if err != nil {
			return false, err
		}
		if membership == agencies.RoleOwner {
			return true, nil
		}
		m, err := reg.AgencyManager(ctx, instanceID)
		if err != nil {
			return false, err
		}
		held, err := heldAgencyRoles(withPartitionContext(accounts.WithID(ctx, actorID), instanceID), reg, instanceID, m)
		if errors.Is(err, errNoLiveVersion) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		for _, role := range held.Roles {
			if !role.Deleted && slices.Contains(role.Permissions, agencies.PaymentListRecipientPermission) {
				return true, nil
			}
		}
		return false, nil
	}
}
