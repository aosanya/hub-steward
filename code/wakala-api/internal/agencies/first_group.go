package agencies

import (
	"context"
	"errors"
	"fmt"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
)

const (
	FirstGroupName         = "Administrators"
	FirstGroupRoleKindName = "Administrator"
)

func SeatOwnerInFirstGroup(ctx context.Context, reg Registry, instanceID, ownerID string) error {
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return fmt.Errorf("SeatOwnerInFirstGroup: %w", err)
	}
	groups, err := directory.ListGroups(ctx, "")
	if err != nil {
		return fmt.Errorf("SeatOwnerInFirstGroup: %w", err)
	}
	if len(groups) > 0 {
		return nil
	}
	if _, err := directory.EnsureActor(ctx, ownerID); err != nil {
		return fmt.Errorf("SeatOwnerInFirstGroup: %w", err)
	}
	group, err := directory.CreateGroup(ctx, mwanachamaactor.Group{Name: FirstGroupName})
	if err != nil {
		return fmt.Errorf("SeatOwnerInFirstGroup: %w", err)
	}
	kind, err := administratorKind(ctx, directory)
	if err != nil {
		return fmt.Errorf("SeatOwnerInFirstGroup: %w", err)
	}
	noApproval := 0
	seat := mwanachamaactor.ActorRoleAssignment{ActorID: ownerID, GroupID: group.ID, KindID: kind.ID, ApprovalLimit: &noApproval}
	if _, err := directory.GrantRole(ctx, seat); err != nil && !errors.Is(err, mwanachamaactor.ErrSeatAlreadyHeld) {
		return fmt.Errorf("SeatOwnerInFirstGroup: %w", err)
	}
	return nil
}

func administratorKind(ctx context.Context, directory mwanachamaactor.UserManager) (mwanachamaactor.RoleKind, error) {
	kinds, err := directory.ListRoleKinds(ctx)
	if err != nil {
		return mwanachamaactor.RoleKind{}, err
	}
	for _, kind := range kinds {
		if kind.Name == FirstGroupRoleKindName && !kind.Retired() {
			return kind, nil
		}
	}
	return directory.CreateRoleKind(ctx, mwanachamaactor.RoleKind{Name: FirstGroupRoleKindName})
}

func IsFirstGroupAdministration(seat LiveSeat) bool {
	return seat.Kind.Name == FirstGroupRoleKindName && seat.Kind.DefinitionRoleID == ""
}
