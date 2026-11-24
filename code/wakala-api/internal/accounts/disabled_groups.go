package accounts

import (
	"context"

	"wakalaserver/internal/agencies"
)

var _ agencies.DisabledGroups = (*Router)(nil)

func (r *Router) disabledGroups(ctx context.Context) (agencies.DisabledGroups, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	kept, ok := reg.(agencies.DisabledGroups)
	if !ok {
		return nil, agencies.ErrNotAMember
	}
	return kept, nil
}

func (r *Router) DisableGroup(ctx context.Context, instanceID, groupID string) error {
	kept, err := r.disabledGroups(ctx)
	if err != nil {
		return err
	}
	return kept.DisableGroup(ctx, instanceID, groupID)
}

func (r *Router) EnableGroup(ctx context.Context, instanceID, groupID string) error {
	kept, err := r.disabledGroups(ctx)
	if err != nil {
		return err
	}
	return kept.EnableGroup(ctx, instanceID, groupID)
}

func (r *Router) DisabledGroupIDs(ctx context.Context, instanceID string) ([]string, error) {
	kept, err := r.disabledGroups(ctx)
	if err != nil {
		return nil, err
	}
	return kept.DisabledGroupIDs(ctx, instanceID)
}
