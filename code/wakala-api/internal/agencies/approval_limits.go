package agencies

import (
	"context"
	"fmt"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaforms "wakalaserver/modules/forms"
)

func (r *registry) approvalLimitsIn(instanceID string) mwanachamaforms.ApprovalLimits {
	return func(ctx context.Context, approverID string, amount int) error {
		directory, err := r.ActorManager(ctx, instanceID)
		if err != nil {
			return fmt.Errorf("approvalLimitsIn: %w", err)
		}
		seats, err := directory.ListRoleAssignmentsForActor(ctx, approverID, true)
		if err != nil {
			return fmt.Errorf("approvalLimitsIn: %w", err)
		}
		for _, s := range seats {
			if mwanachamaactor.WithinLimit(s, amount) {
				return nil
			}
		}
		return mwanachamaforms.ErrOverApprovalLimit
	}
}
