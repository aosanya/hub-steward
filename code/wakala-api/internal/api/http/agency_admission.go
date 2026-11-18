package http

import (
	"context"

	"wakalaserver/internal/agencies"
)

func (d *Deps) admittedByAgency(ctx context.Context, subject, action string) bool {
	instanceID := partitionOf(ctx)
	if instanceID == "" || d.Registry == nil {
		return false
	}
	role, err := d.Registry.RoleOf(ctx, instanceID, subject)
	if err != nil {
		return false
	}
	if role == agencies.RoleOwner {
		return true
	}
	return d.heldRolesAllow(ctx, d.Registry, action)
}
