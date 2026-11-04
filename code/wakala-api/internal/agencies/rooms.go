package agencies

import (
	"context"
	"errors"
	"fmt"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamacomm "wakalaserver/modules/comm"

	"wakalaserver/internal/notifyrules"
)

const GeneralThreadLabel = "General"

const AuthorKindAgent = "agent"

func (r *registry) belongingIn(instanceID string) mwanachamacomm.Belonging {
	return func(ctx context.Context, actorID, structureID string) (bool, error) {
		return r.inRoom(ctx, instanceID, actorID, structureID)
	}
}

func (r *registry) authorKindIn(instanceID string) mwanachamacomm.AuthorKindOf {
	return func(ctx context.Context, actorID string) (string, error) {
		role, err := r.RoleOf(ctx, instanceID, actorID)
		if err != nil {
			return "", err
		}
		if role == RoleAgent {
			return AuthorKindAgent, nil
		}
		return "", nil
	}
}

func (r *registry) leadingIn(instanceID string) mwanachamacomm.Leading {
	return func(ctx context.Context, actorID, structureID string) (bool, error) {
		return r.leadsRoom(ctx, instanceID, actorID, structureID)
	}
}

func (r *registry) roomsOfIn(instanceID string) mwanachamacomm.RoomsOf {
	return func(ctx context.Context, actorID string) ([]string, error) {
		return r.roomsOf(ctx, instanceID, actorID)
	}
}

func (r *registry) roomLeadsIn(instanceID string) mwanachamacomm.Leads {
	return func(ctx context.Context, structureID string) ([]string, error) {
		leaders, err := r.leadersInRoom(ctx, instanceID, structureID)
		if err != nil {
			return nil, err
		}
		roster := notifyrules.Roster{notifyrules.GroupLeaders: leaders}
		if err := r.addStaff(ctx, instanceID, roster); err != nil {
			return nil, fmt.Errorf("room leads: %w", err)
		}
		return notifyrules.Resolve(r.ruleIn(ctx, instanceID, notifyrules.ThreadStarted), roster), nil
	}
}

func (r *registry) ruleIn(ctx context.Context, instanceID string, e notifyrules.Event) notifyrules.Rule {
	if r.rules != nil {
		if rule, err := r.rules(ctx, instanceID, e); err == nil {
			return rule
		}
	}
	rule, _ := notifyrules.Default(e)
	return rule
}

func (r *registry) addStaff(ctx context.Context, instanceID string, roster notifyrules.Roster) error {
	var rows []memberRow
	if err := r.db.WithContext(ctx).Where("instance_id = ? AND role IN ?", instanceID, operatorRoles).
		Order("created_at").Find(&rows).Error; err != nil {
		return err
	}
	for _, row := range rows {
		switch row.Role {
		case RoleOwner:
			roster[notifyrules.Owners] = append(roster[notifyrules.Owners], row.UserID)
		case RoleAgent:
			roster[notifyrules.Agents] = append(roster[notifyrules.Agents], row.UserID)
		}
	}
	return nil
}

func (r *registry) leadersInRoom(ctx context.Context, instanceID, structureID string) ([]string, error) {
	leaders, err := r.groupLeadersOf(ctx, instanceID, structureID)
	if err != nil {
		return nil, err
	}
	var present []string
	for _, leader := range leaders {
		in, err := r.inRoom(ctx, instanceID, leader, structureID)
		if err != nil {
			return nil, fmt.Errorf("room leads: %w", err)
		}
		if in {
			present = append(present, leader)
		}
	}
	return present, nil
}

func (r *registry) inRoom(ctx context.Context, instanceID, actorID, structureID string) (bool, error) {
	if structureID == "" || actorID == "" {
		return false, nil
	}
	groups, err := r.groupsOf(ctx, instanceID, actorID)
	if err != nil {
		return false, err
	}
	for _, g := range groups {
		if g == structureID {
			return true, nil
		}
	}
	operator, err := r.IsMember(ctx, instanceID, actorID)
	if err != nil || !operator {
		return false, err
	}
	directory, err := r.ActorManager(ctx, instanceID)
	if err != nil {
		return false, fmt.Errorf("room belonging: %w", err)
	}
	return groupExists(ctx, directory, structureID)
}

func (r *registry) roomsOf(ctx context.Context, instanceID, actorID string) ([]string, error) {
	rooms, err := r.groupsOf(ctx, instanceID, actorID)
	if err != nil {
		return nil, err
	}
	operator, err := r.IsMember(ctx, instanceID, actorID)
	if err != nil || !operator {
		return rooms, err
	}
	directory, err := r.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, fmt.Errorf("rooms of: %w", err)
	}
	groups, err := directory.ListGroups(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("rooms of: %w", err)
	}
	for _, g := range groups {
		rooms = append(rooms, g.ID)
	}
	return rooms, nil
}

func (r *registry) leadsRoom(ctx context.Context, instanceID, actorID, structureID string) (bool, error) {
	if structureID == "" || actorID == "" {
		return false, nil
	}
	operator, err := r.IsMember(ctx, instanceID, actorID)
	if err != nil || operator {
		return operator, err
	}
	directory, err := r.ActorManager(ctx, instanceID)
	if err != nil {
		return false, fmt.Errorf("room leading: %w", err)
	}
	return directory.IsGroupLeader(ctx, structureID, actorID)
}

func groupExists(ctx context.Context, directory mwanachamaactor.UserManager, groupID string) (bool, error) {
	_, err := directory.GetGroup(ctx, groupID)
	if errors.Is(err, mwanachamaactor.ErrGroupNotFound) {
		return false, nil
	}
	return err == nil, err
}

func (r *registry) groupLeadersOf(ctx context.Context, instanceID, groupID string) ([]string, error) {
	directory, err := r.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, fmt.Errorf("group leaders: %w", err)
	}
	return GroupLeaders(ctx, directory, groupID)
}

func GroupLeaders(ctx context.Context, directory mwanachamaactor.UserManager, groupID string) ([]string, error) {
	seats, err := directory.ListRoleAssignmentsForGroup(ctx, groupID, true)
	if err != nil {
		return nil, fmt.Errorf("group leaders: %w", err)
	}
	seen := map[string]bool{}
	var out []string
	for _, seat := range seats {
		if seen[seat.ActorID] {
			continue
		}
		seen[seat.ActorID] = true
		leads, err := directory.IsGroupLeader(ctx, groupID, seat.ActorID)
		if err != nil {
			return nil, fmt.Errorf("group leaders: %w", err)
		}
		if leads {
			out = append(out, seat.ActorID)
		}
	}
	return out, nil
}

func (r *registry) OpenGeneralThread(ctx context.Context, instanceID, structureID, callerID string) error {
	belongs, err := r.inRoom(ctx, instanceID, callerID, structureID)
	if err != nil || !belongs {
		return err
	}
	rooms, err := r.CommManager(ctx, instanceID)
	if err != nil {
		return err
	}
	general, err := rooms.ChatStore.StartThread(ctx, structureID, GeneralThreadLabel)
	if err != nil {
		return fmt.Errorf("general thread: %w", err)
	}
	if _, err := rooms.ChatStore.OpenThread(ctx, structureID, general.ID); err != nil {
		return fmt.Errorf("general thread: %w", err)
	}
	return nil
}
