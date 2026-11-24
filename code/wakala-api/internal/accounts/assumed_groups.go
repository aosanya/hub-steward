package accounts

import (
	"context"
	"time"

	"wakalaserver/internal/agencies"
)

func (r *Router) assumedGroups(ctx context.Context) (agencies.AssumedGroups, error) {
	reg, err := r.pick(ctx)
	if err != nil {
		return nil, err
	}
	kept, ok := reg.(agencies.AssumedGroups)
	if !ok {
		return nil, agencies.ErrNotAMember
	}
	return kept, nil
}

func (r *Router) AssumeGroup(ctx context.Context, sessionKey, instanceID, memberID, groupID string, endsAt time.Time) error {
	kept, err := r.assumedGroups(ctx)
	if err != nil {
		return err
	}
	return kept.AssumeGroup(ctx, sessionKey, instanceID, memberID, groupID, endsAt)
}

func (r *Router) AssumedGroupOf(ctx context.Context, sessionKey, instanceID, memberID string) (string, error) {
	kept, err := r.assumedGroups(ctx)
	if err != nil {
		return "", err
	}
	return kept.AssumedGroupOf(ctx, sessionKey, instanceID, memberID)
}
