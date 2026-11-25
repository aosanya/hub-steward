package http

import (
	"context"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"

	"wakalaserver/internal/agencies"
)

func TagRowCounter(registry func() agencies.Registry) agencies.TagRowCounter {
	return func(ctx context.Context, instanceID, tagID string) (int, error) {
		reg := registry()
		if reg == nil {
			return 0, nil
		}
		m, err := reg.AgencyManager(ctx, instanceID)
		if err != nil {
			return 0, err
		}
		drafts, err := draftsOfEveryPublication(ctx, m)
		if err != nil {
			return 0, err
		}
		carrying := 0
		for _, id := range drafts {
			found, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{Tags: []string{tagID}, IncludeRetired: true, IncludeReturned: true})
			if err != nil {
				return 0, err
			}
			carrying += len(found)
		}
		return carrying, nil
	}
}
