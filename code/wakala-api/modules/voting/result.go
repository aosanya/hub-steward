package voting

import (
	"context"
	"fmt"
	"slices"

	"wakalaserver/modules/shared/specstore"
)

type Publication struct {
	PollID      string   `json:"poll_id"`
	PublishedBy string   `json:"published_by"`
	GroupIDs    []string `json:"group_ids"`
}

func (m *pollManager) PublishResult(ctx context.Context, in Publication) (Poll, error) {
	if in.PublishedBy == "" {
		return Poll{}, ErrNoPublisher
	}
	if len(in.GroupIDs) == 0 {
		return Poll{}, fmt.Errorf("%w: a result is published to at least one group", ErrInvalidPublication)
	}
	p, err := m.GetPoll(ctx, in.PollID)
	if err != nil {
		return Poll{}, err
	}
	p.PublishedAt, p.PublishedBy, p.PublishedGroupIDs = m.now(), in.PublishedBy, in.GroupIDs
	row, err := specstore.Encode(m.st.Object(objectPoll), p)
	if err != nil {
		return Poll{}, fmt.Errorf("PublishResult: %w", err)
	}
	cols := map[string]any{}
	for _, c := range []string{"published_at", "published_by", "published_group_ids"} {
		cols[c] = row[c]
	}
	if err := m.st.Query(ctx, objectPoll).Where("id = ?", p.ID).Updates(cols).Error; err != nil {
		return Poll{}, fmt.Errorf("PublishResult: %w", err)
	}
	return m.GetPoll(ctx, p.ID)
}

func (m *pollManager) ReadPublishedCount(ctx context.Context, pollID, caller string) (Count, error) {
	if caller == "" {
		return Count{}, ErrNoReader
	}
	p, err := m.GetPoll(ctx, pollID)
	if err != nil {
		return Count{}, err
	}
	if p.PublishedAt == "" {
		return Count{}, ErrPollNotFound
	}
	groups, err := m.callerGroups(ctx, caller)
	if err != nil {
		return Count{}, fmt.Errorf("ReadPublishedCount: %w", err)
	}
	for _, g := range groups {
		if slices.Contains(p.PublishedGroupIDs, g) {
			raw, err := m.CountPoll(ctx, p.ID)
			if err != nil {
				return Count{}, err
			}
			minimum, err := m.minimumCount(ctx)
			if err != nil {
				return Count{}, err
			}
			return Disclose(raw, minimum)
		}
	}
	return Count{}, ErrPollNotFound
}
