package http

import (
	"context"
	"strings"

	"wakalaserver/internal/agencies"
)

func isStaff(ctx context.Context, reg agencies.Registry, instanceID, actorID string) (bool, error) {
	actorID = strings.TrimSpace(actorID)
	role, err := reg.RoleOf(ctx, instanceID, actorID)
	if err != nil {
		return false, err
	}
	if role == agencies.RoleOwner || role == agencies.RoleAgent {
		return true, nil
	}
	return holdsStaffKind(ctx, reg, instanceID, actorID)
}

func holdsStaffKind(ctx context.Context, reg agencies.Registry, instanceID, actorID string) (bool, error) {
	if actorID == "" {
		return false, nil
	}
	um, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return false, nil
	}
	seats, err := um.ListRoleAssignmentsForActor(ctx, actorID, true)
	if err != nil {
		return false, err
	}
	for _, seat := range seats {
		kind, err := um.GetRoleKind(ctx, seat.KindID)
		if err != nil {
			continue
		}
		if kind.Staff && !kind.Retired() {
			return true, nil
		}
	}
	return false, nil
}
