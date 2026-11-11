package voting

import (
	"context"
	"fmt"
	"slices"
	"time"
)

func (m *pollManager) OpenToReader(ctx context.Context, pollID, reader string) error {
	p, err := m.GetPoll(ctx, pollID)
	if err != nil {
		return err
	}
	if !hasOpened(p, m.now()) {
		return ErrPollNotFound
	}
	groups, err := m.callerGroups(ctx, reader)
	if err != nil {
		return fmt.Errorf("OpenToReader: %w", err)
	}
	for _, g := range groups {
		if slices.Contains(p.GroupIDs, g) {
			return nil
		}
	}
	return ErrPollNotFound
}

func hasOpened(p Poll, now string) bool {
	at, err := time.Parse(time.RFC3339Nano, now)
	if err != nil {
		return false
	}
	opens, err := time.Parse(time.RFC3339Nano, p.OpensAt)
	if err != nil {
		return false
	}
	return !at.Before(opens)
}
