package agencies

import (
	"context"
	"fmt"
	"slices"

	mwanachamacomm "wakalaserver/modules/comm"
	commmodels "wakalaserver/modules/comm/models"

	"wakalaserver/internal/notifyrules"
)

func (r *registry) roomRecipientsIn(instanceID string) mwanachamacomm.Recipients {
	return func(ctx context.Context, event commmodels.NotificationEvent, room mwanachamacomm.RaiseRoom, defaults []string) ([]string, error) {
		if event != commmodels.EventThreadDeclined {
			return defaults, nil
		}
		rule := r.ruleIn(ctx, instanceID, notifyrules.ThreadDeclined)
		roster := notifyrules.Roster{notifyrules.Subject: defaults}
		if namesAudience(rule, notifyrules.GroupLeaders) {
			leaders, err := r.leadersInRoom(ctx, instanceID, room.StructureID)
			if err != nil {
				return nil, err
			}
			roster[notifyrules.GroupLeaders] = leaders
		}
		if namesAudience(rule, notifyrules.Owners) || namesAudience(rule, notifyrules.Agents) {
			if err := r.addStaff(ctx, instanceID, roster); err != nil {
				return nil, fmt.Errorf("decline recipients: %w", err)
			}
		}
		return notifyrules.Resolve(rule, roster), nil
	}
}

func namesAudience(rule notifyrules.Rule, a notifyrules.Audience) bool {
	return slices.Contains(rule.Told, a) || slices.Contains(rule.Fallback, a)
}
