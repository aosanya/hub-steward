package agencies

import (
	"context"
	"slices"

	mwanachamataskmanager "github.com/aosanya/mwanachama-backend-taskmanager"
)

func (r *registry) assumedGroupsIn(instanceID string) mwanachamataskmanager.Groups {
	return func(ctx context.Context, callerID string) ([]string, error) {
		groupID, err := AssumedGroupOfCaller(ctx, r, instanceID, callerID)
		if err != nil || groupID == "" {
			return nil, err
		}
		return []string{groupID}, nil
	}
}

func GroupHoldsBacklogAccess(ctx context.Context, reg Registry, instanceID, groupID string) (bool, error) {
	if groupID == "" {
		return false, nil
	}
	board, err := reg.TaskManager(ctx, instanceID)
	if err != nil {
		return false, err
	}
	backlogs, err := board.ListBacklogs(ctx)
	if err != nil {
		return false, err
	}
	for _, backlog := range backlogs.Items {
		access, err := board.ListBacklogAccess(ctx, backlog.ID)
		if err != nil {
			return false, err
		}
		if access.OwnerGroup == groupID || slices.ContainsFunc(access.Groups, func(g mwanachamataskmanager.GroupAccess) bool { return g.GroupID == groupID && !g.Gone }) {
			return true, nil
		}
	}
	return false, nil
}

func AssumedGroupHoldsBacklogAccess(ctx context.Context, reg Registry, instanceID, callerID string) (bool, error) {
	groupID, err := AssumedGroupOfCaller(ctx, reg, instanceID, callerID)
	if err != nil {
		return false, err
	}
	return GroupHoldsBacklogAccess(ctx, reg, instanceID, groupID)
}
