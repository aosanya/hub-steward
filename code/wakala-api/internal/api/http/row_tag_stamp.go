package http

import (
	"context"
	"errors"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

var (
	errRowNeedsAGroup = errors.New("assume a group before adding a row: a new row takes the tags of the group you act as")
	errRowGroupNoTag  = errors.New("the group you act as has no tag, so a row added in it would belong to nobody: ask an administrator to give the group a tag")
)

func (d *Deps) tagsOfNewRow(ctx context.Context, instanceID string) ([]string, error) {
	groupID, err := agencies.AssumedGroupOfCaller(ctx, d.Registry, instanceID, accounts.IDFromContext(ctx))
	if err != nil {
		return nil, err
	}
	if groupID == "" {
		return nil, errRowNeedsAGroup
	}
	store, err := d.tagStore()
	if err != nil {
		return nil, err
	}
	tags, err := store.GroupTags(ctx, instanceID, groupID)
	if err != nil {
		return nil, err
	}
	if len(tags) == 0 {
		return nil, errRowGroupNoTag
	}
	ids := make([]string, 0, len(tags))
	for _, tag := range tags {
		ids = append(ids, tag.ID)
	}
	return ids, nil
}
