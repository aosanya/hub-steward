package agencies

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamacomm "wakalaserver/modules/comm"
	mwanachamaforms "wakalaserver/modules/forms"
)

var ErrNoActLog = errors.New("comm: no act log is mounted, so a moderation act cannot be recorded")

type RefusingActLog struct{}

func (RefusingActLog) WriteAct(context.Context, *sql.Tx, mwanachamacomm.ActEntry) error {
	return ErrNoActLog
}

func (r *registry) groupsOf(ctx context.Context, instanceID, callerID string) ([]string, error) {
	if instanceID == "" || callerID == "" {
		return nil, nil
	}
	directory, err := r.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, fmt.Errorf("groupsOf: %w", err)
	}
	held, err := directory.ListGroupsForActor(ctx, callerID)
	if err != nil {
		return nil, fmt.Errorf("groupsOf: %w", err)
	}
	seen := make(map[string]bool, len(held))
	out := make([]string, 0, len(held))
	for _, a := range held {
		if a.Deleted || a.GroupID == "" || seen[a.GroupID] {
			continue
		}
		seen[a.GroupID] = true
		out = append(out, a.GroupID)
	}
	return out, nil
}

func (r *registry) groupsIn(instanceID string) mwanachamaforms.Groups {
	return func(ctx context.Context, callerID string) ([]string, error) {
		return r.groupsOf(ctx, instanceID, callerID)
	}
}

func (r *registry) namesIn(instanceID string) mwanachamaforms.Names {
	return func(ctx context.Context, callerID string) (string, error) {
		if callerID == "" {
			return "", nil
		}
		directory, err := r.ActorManager(ctx, instanceID)
		if err != nil {
			return "", fmt.Errorf("namesIn: %w", err)
		}
		held, err := directory.GetActor(ctx, callerID)
		if errors.Is(err, mwanachamaactor.ErrActorNotFound) {
			return "", nil
		}
		if err != nil {
			return "", fmt.Errorf("namesIn: %w", err)
		}
		return held.DisplayName, nil
	}
}
