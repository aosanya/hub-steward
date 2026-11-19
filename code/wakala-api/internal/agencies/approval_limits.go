package agencies

import (
	"context"
	"fmt"

	mwanachamaforms "github.com/aosanya/mwanachama-backend-forms"
	mwanachamaactor "wakalaserver/modules/actor"
)

func (r *registry) approvalLimitsIn(instanceID string) mwanachamaforms.ApprovalLimits {
	return func(ctx context.Context, approverID string, amount int) (mwanachamaforms.ApprovalCover, error) {
		directory, err := r.ActorManager(ctx, instanceID)
		if err != nil {
			return mwanachamaforms.ApprovalCover{}, fmt.Errorf("approvalLimitsIn: %w", err)
		}
		outcome, err := mwanachamaactor.ApprovalOutcomeFor(ctx, directory, approverID, amount)
		if err != nil {
			return mwanachamaforms.ApprovalCover{}, fmt.Errorf("approvalLimitsIn: %w", err)
		}
		if !outcome.Allowed {
			return mwanachamaforms.ApprovalCover{}, mwanachamaforms.ErrOverApprovalLimit
		}
		return mwanachamaforms.ApprovalCover{OverLimit: outcome.OverLimit, Limit: outcome.Limit}, nil
	}
}
