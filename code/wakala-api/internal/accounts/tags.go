package accounts

import (
	"context"

	"wakalaserver/internal/agencies"
)

var _ agencies.Tags = (*Router)(nil)

func (r *Router) tags(ctx context.Context) (agencies.Tags, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	kept, ok := reg.(agencies.Tags)
	if !ok {
		return nil, agencies.ErrNotAMember
	}
	return kept, nil
}

func (r *Router) ListTags(ctx context.Context, instanceID string) ([]agencies.Tag, error) {
	kept, err := r.tags(ctx)
	if err != nil {
		return nil, err
	}
	return kept.ListTags(ctx, instanceID)
}

func (r *Router) CreateTag(ctx context.Context, instanceID, name string) (agencies.Tag, error) {
	kept, err := r.tags(ctx)
	if err != nil {
		return agencies.Tag{}, err
	}
	return kept.CreateTag(ctx, instanceID, name)
}

func (r *Router) RenameTag(ctx context.Context, instanceID, tagID, name string) (agencies.Tag, error) {
	kept, err := r.tags(ctx)
	if err != nil {
		return agencies.Tag{}, err
	}
	return kept.RenameTag(ctx, instanceID, tagID, name)
}

func (r *Router) DeleteTag(ctx context.Context, instanceID, tagID string) error {
	kept, err := r.tags(ctx)
	if err != nil {
		return err
	}
	return kept.DeleteTag(ctx, instanceID, tagID)
}

func (r *Router) GiveGroupTag(ctx context.Context, instanceID, groupID, tagID string) error {
	kept, err := r.tags(ctx)
	if err != nil {
		return err
	}
	return kept.GiveGroupTag(ctx, instanceID, groupID, tagID)
}

func (r *Router) TakeGroupTag(ctx context.Context, instanceID, groupID, tagID string) error {
	kept, err := r.tags(ctx)
	if err != nil {
		return err
	}
	return kept.TakeGroupTag(ctx, instanceID, groupID, tagID)
}

func (r *Router) GroupTags(ctx context.Context, instanceID, groupID string) ([]agencies.Tag, error) {
	kept, err := r.tags(ctx)
	if err != nil {
		return nil, err
	}
	return kept.GroupTags(ctx, instanceID, groupID)
}
