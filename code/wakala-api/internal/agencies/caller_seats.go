package agencies

import (
	"context"
	"errors"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
)

type loginSessionKey struct{}

func WithLoginSession(ctx context.Context, sessionKey string) context.Context {
	if sessionKey == "" {
		return ctx
	}
	return context.WithValue(ctx, loginSessionKey{}, sessionKey)
}

func LoginSessionOf(ctx context.Context) string {
	key, _ := ctx.Value(loginSessionKey{}).(string)
	return key
}

type LiveSeat struct {
	Seat  mwanachamaactor.ActorRoleAssignment
	Kind  mwanachamaactor.RoleKind
	Group mwanachamaactor.Group
}

func (s LiveSeat) DefinitionRoleID() string {
	return s.Kind.DefinitionRoleID
}

func groupDisabled(mwanachamaactor.Group) bool {
	return false
}

func GroupAssumable(group mwanachamaactor.Group) bool {
	return !group.Deleted && !groupDisabled(group)
}

func LiveSeatsOf(ctx context.Context, directory mwanachamaactor.UserManager, actorID string) ([]LiveSeat, error) {
	seats, err := directory.ListRoleAssignmentsForActor(ctx, actorID, true)
	if err != nil || len(seats) == 0 {
		return []LiveSeat{}, err
	}
	kinds, err := directory.ListRoleKinds(ctx)
	if err != nil {
		return nil, err
	}
	liveKind := make(map[string]mwanachamaactor.RoleKind, len(kinds))
	for _, k := range kinds {
		if !k.Retired() {
			liveKind[k.ID] = k
		}
	}
	groups := map[string]*mwanachamaactor.Group{}
	out := []LiveSeat{}
	for _, seat := range seats {
		kind, live := liveKind[seat.KindID]
		if !live {
			continue
		}
		group, known := groups[seat.GroupID]
		if !known {
			found, err := directory.GetGroup(ctx, seat.GroupID)
			switch {
			case errors.Is(err, mwanachamaactor.ErrGroupNotFound):
				group = nil
			case err != nil:
				return nil, err
			case GroupAssumable(found):
				group = &found
			}
			groups[seat.GroupID] = group
		}
		if group != nil {
			out = append(out, LiveSeat{Seat: seat, Kind: kind, Group: *group})
		}
	}
	return out, nil
}

func AssumedGroupOfCaller(ctx context.Context, reg Registry, instanceID, actorID string) (string, error) {
	sessionKey := LoginSessionOf(ctx)
	kept, ok := reg.(AssumedGroups)
	if !ok || sessionKey == "" || actorID == "" {
		return "", nil
	}
	return kept.AssumedGroupOf(ctx, sessionKey, instanceID, actorID)
}

func SeatsInAssumedGroup(ctx context.Context, reg Registry, instanceID, actorID string) ([]LiveSeat, error) {
	groupID, err := AssumedGroupOfCaller(ctx, reg, instanceID, actorID)
	if err != nil || groupID == "" {
		return []LiveSeat{}, err
	}
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	seats, err := LiveSeatsOf(ctx, directory, actorID)
	if err != nil {
		return nil, err
	}
	inGroup := []LiveSeat{}
	for _, seat := range seats {
		if seat.Seat.GroupID == groupID {
			inGroup = append(inGroup, seat)
		}
	}
	return inGroup, nil
}

func SeatsInAnyGroup(ctx context.Context, reg Registry, instanceID, actorID string) ([]LiveSeat, error) {
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	return LiveSeatsOf(ctx, directory, actorID)
}

type assumedSeatsDirectory struct {
	mwanachamaactor.UserManager
	actorID string
	seats   []mwanachamaactor.ActorRoleAssignment
}

func (d assumedSeatsDirectory) ListRoleAssignmentsForActor(_ context.Context, actorID string, _ bool) ([]mwanachamaactor.ActorRoleAssignment, error) {
	if actorID != d.actorID {
		return []mwanachamaactor.ActorRoleAssignment{}, nil
	}
	return d.seats, nil
}

func AssumedSeatsDirectory(ctx context.Context, reg Registry, instanceID, actorID string) (mwanachamaactor.UserManager, error) {
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	seats, err := SeatsInAssumedGroup(ctx, reg, instanceID, actorID)
	if err != nil {
		return nil, err
	}
	assignments := make([]mwanachamaactor.ActorRoleAssignment, 0, len(seats))
	for _, seat := range seats {
		assignments = append(assignments, seat.Seat)
	}
	return assumedSeatsDirectory{UserManager: directory, actorID: actorID, seats: assignments}, nil
}
