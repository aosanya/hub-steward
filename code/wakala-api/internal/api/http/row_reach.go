package http

import (
	"context"
	"slices"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type rowReach struct {
	everyRow bool
	tagIDs   []string
}

func (d *Deps) rowReachOfCaller(ctx context.Context, instanceID string) (rowReach, error) {
	groupID, err := agencies.AssumedGroupOfCaller(ctx, d.Registry, instanceID, accounts.IDFromContext(ctx))
	if err != nil || groupID == "" {
		return rowReach{}, err
	}
	kept, ok := d.Registry.(agencies.Tags)
	if !ok {
		return rowReach{}, nil
	}
	carried, err := kept.GroupTags(ctx, instanceID, groupID)
	if err != nil {
		return rowReach{}, err
	}
	reach := rowReach{}
	for _, tag := range carried {
		reach.everyRow = reach.everyRow || tag.System
		reach.tagIDs = append(reach.tagIDs, tag.ID)
	}
	return reach, nil
}

func (r rowReach) reachesNoRow() bool {
	return !r.everyRow && len(r.tagIDs) == 0
}

func (r rowReach) listTags() []string {
	if r.everyRow {
		return nil
	}
	return r.tagIDs
}

func (r rowReach) reaches(row agencymodels.RecordRow) bool {
	if r.everyRow {
		return true
	}
	return slices.ContainsFunc(row.Tags, func(tag string) bool { return slices.Contains(r.tagIDs, tag) })
}
