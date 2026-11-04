package http

import (
	"context"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/accounts"
)

type reviewsBySignedIn struct {
	mwanachamaagency.AgencyManager
}

func (m reviewsBySignedIn) StartReview(ctx context.Context, draftID, _, area string) (agencymodels.ReviewView, error) {
	return m.AgencyManager.StartReview(ctx, draftID, accounts.IDFromContext(ctx), area)
}

func (m reviewsBySignedIn) CommentFinding(ctx context.Context, findingID, body, _ string) (agencymodels.ReviewComment, error) {
	return m.AgencyManager.CommentFinding(ctx, findingID, body, accounts.IDFromContext(ctx))
}
