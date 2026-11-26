package agencies

import (
	"context"

	mwanachamataskmanager "github.com/aosanya/mwanachama-backend-taskmanager"
)

type HoldsRole func(ctx context.Context, instanceID, actorID, role string) (bool, error)

func WithQuestionRoleHolders(holds HoldsRole) Option {
	return func(r *registry) { r.questionRoleHolds = holds }
}

func (r *registry) questionRoleHolderIn(instanceID string) mwanachamataskmanager.RoleHolder {
	return func(ctx context.Context, callerID, role string) (bool, error) {
		return r.questionRoleHolds(ctx, instanceID, callerID, role)
	}
}
