package agencies

import (
	"context"

	mwanachamaforms "github.com/aosanya/mwanachama-backend-forms"
)

func (r *registry) standingAudienceIn(instanceID string) mwanachamaforms.StandingAudience {
	return func(ctx context.Context, callerID, groupID string) (bool, error) {
		return r.inRoom(ctx, instanceID, callerID, groupID)
	}
}
