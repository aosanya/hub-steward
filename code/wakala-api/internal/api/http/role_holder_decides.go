package http

import (
	"context"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
)

type roleHolderDecides struct {
	mwanachamaactor.UserManager
}

func (r roleHolderDecides) ApproveJoinRequest(ctx context.Context, id, decidedBy string) (mwanachamaactor.GroupJoinRequest, error) {
	return r.OperatorApproveJoinRequest(ctx, id, decidedBy)
}

func (r roleHolderDecides) DeclineJoinRequest(ctx context.Context, id, decidedBy string, silent bool, reason string) (mwanachamaactor.GroupJoinRequest, error) {
	return r.OperatorDeclineJoinRequest(ctx, id, decidedBy, silent, reason)
}
