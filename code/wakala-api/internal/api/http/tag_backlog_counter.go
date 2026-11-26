package http

import (
	"context"
	"slices"

	"wakalaserver/internal/agencies"
)

func TagBacklogCounter(registry func() agencies.Registry) agencies.TagBacklogCounter {
	return func(ctx context.Context, instanceID, tagID string) (int, error) {
		reg := registry()
		if reg == nil {
			return 0, nil
		}
		board, err := reg.TaskManager(ctx, instanceID)
		if err != nil {
			return 0, err
		}
		listed, err := board.ListBacklogs(ctx)
		if err != nil {
			return 0, err
		}
		carrying := 0
		for _, backlog := range listed.Items {
			if slices.Contains(backlog.Tags, tagID) {
				carrying++
			}
		}
		return carrying, nil
	}
}
