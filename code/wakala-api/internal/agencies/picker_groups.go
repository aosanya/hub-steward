package agencies

import (
	"context"
	"fmt"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

func (r *registry) pickerGroups(instanceID string) mwanachamaagency.GroupLister {
	return func(ctx context.Context) ([]agencymodels.PickerActor, error) {
		directory, err := r.ActorManager(ctx, instanceID)
		if err != nil {
			return nil, fmt.Errorf("the groups of instance %s: %w", instanceID, err)
		}
		groups, err := directory.ListGroups(ctx, "")
		if err != nil {
			return nil, fmt.Errorf("the groups of instance %s: %w", instanceID, err)
		}
		out := make([]agencymodels.PickerActor, 0, len(groups))
		for _, g := range groups {
			out = append(out, agencymodels.PickerActor{ID: g.ID, Name: g.Name})
		}
		return out, nil
	}
}
