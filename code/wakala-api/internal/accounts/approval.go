package accounts

import (
	"context"

	"wakalaserver/internal/agencies"
)

func (r *Router) ListPendingInstances(ctx context.Context) ([]agencies.Instance, error) {
	approvals, ok := r.shared.(agencies.ApprovalRegistry)
	if !ok {
		return []agencies.Instance{}, nil
	}
	return approvals.ListPendingInstances(ctx)
}

func (r *Router) DecideApproval(ctx context.Context, instanceID string, approve bool, note string) (agencies.Instance, error) {
	approvals, ok := r.shared.(agencies.ApprovalRegistry)
	if !ok {
		return agencies.Instance{}, agencies.ErrInstanceNotFound
	}
	return approvals.DecideApproval(ctx, instanceID, approve, note)
}
