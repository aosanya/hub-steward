package http

import (
	"context"
	"errors"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

func QuestionRoleHolders(regOf func() agencies.Registry) agencies.HoldsRole {
	return func(ctx context.Context, instanceID, actorID, role string) (bool, error) {
		reg := regOf()
		m, err := reg.AgencyManager(ctx, instanceID)
		if err != nil {
			return false, err
		}
		held, err := heldAgencyRolesInAnyGroup(withPartitionContext(accounts.WithID(ctx, actorID), instanceID), reg, instanceID, actorID, m)
		if errors.Is(err, errNoLiveVersion) {
			return false, nil
		}
		if err != nil {
			return false, err
		}
		for _, held := range held.Roles {
			if !held.Deleted && isRoleNamed(role, held) {
				return true, nil
			}
		}
		return false, nil
	}
}
