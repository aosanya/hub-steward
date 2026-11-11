package http

import (
	"context"

	mwanachamaactor "wakalaserver/modules/actor"
	actormodels "wakalaserver/modules/actor/models"

	"wakalaserver/internal/accounts"
)

const joinRequestUnderReview = "under_review"

type quietDeclinesUnseen struct {
	mwanachamaactor.UserManager
}

func (m quietDeclinesUnseen) ListJoinRequestsForActor(ctx context.Context, actorID string) ([]mwanachamaactor.GroupJoinRequest, error) {
	held, err := m.UserManager.ListJoinRequestsForActor(ctx, actorID)
	if err != nil {
		return nil, err
	}
	for i := range held {
		held[i] = withoutDecider(asTheApplicantSeesIt(held[i]))
	}
	return held, nil
}

func (m quietDeclinesUnseen) ListInvitationsForActor(ctx context.Context, actorID string) ([]mwanachamaactor.GroupInvitation, error) {
	held, err := m.UserManager.ListInvitationsForActor(ctx, actorID)
	if err != nil {
		return nil, err
	}
	for i := range held {
		held[i].InvitedBy = ""
	}
	return held, nil
}

func (m quietDeclinesUnseen) GetMyJoinDecision(ctx context.Context, decisionID, actorID string) (mwanachamaactor.JoinDecision, error) {
	decision, err := m.UserManager.GetMyJoinDecision(ctx, decisionID, actorID)
	decision.DecidedBy = ""
	return decision, err
}

func (m quietDeclinesUnseen) GetJoinRequest(ctx context.Context, id string) (mwanachamaactor.GroupJoinRequest, error) {
	req, err := m.UserManager.GetJoinRequest(ctx, id)
	if err != nil || req.ActorID != accounts.IDFromContext(ctx) {
		return req, err
	}
	return withoutDecider(asTheApplicantSeesIt(req)), nil
}

func (m quietDeclinesUnseen) FindGroupByCode(ctx context.Context, code, actorID string) (mwanachamaactor.GroupByCode, error) {
	found, err := m.UserManager.FindGroupByCode(ctx, code, actorID)
	if err != nil || found.Request == nil {
		return found, err
	}
	seen := withoutDecider(asTheApplicantSeesIt(*found.Request))
	found.Request = &seen
	if found.State == actormodels.CallerDeclined && found.Request.State == joinRequestUnderReview {
		found.State = actormodels.CallerRequested
	}
	return found, nil
}

func withoutDecider(req mwanachamaactor.GroupJoinRequest) mwanachamaactor.GroupJoinRequest {
	req.DecidedBy = ""
	return req
}

func asTheApplicantSeesIt(req mwanachamaactor.GroupJoinRequest) mwanachamaactor.GroupJoinRequest {
	if req.State != actormodels.JoinRequestDeclined || !req.Silent {
		return req
	}
	req.State = joinRequestUnderReview
	req.Silent = false
	req.DecidedBy = ""
	req.DecidedAt = ""
	req.LastUpdated = lastAsked(req)
	return req
}

func lastAsked(req mwanachamaactor.GroupJoinRequest) string {
	if req.AskedAt != "" {
		return req.AskedAt
	}
	return req.RequestedAt
}
