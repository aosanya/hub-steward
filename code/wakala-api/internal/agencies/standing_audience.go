package agencies

import (
	"context"

	mwanachamaforms "wakalaserver/modules/forms"
)

func (r *registry) standingAudienceIn(instanceID string) mwanachamaforms.StandingAudience {
	return func(ctx context.Context, callerID, groupID string) (bool, error) {
		return r.inRoom(ctx, instanceID, callerID, groupID)
	}
}
