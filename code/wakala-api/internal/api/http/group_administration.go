package http

import (
	"context"
	"fmt"
	"slices"

	"github.com/aosanya/mwanachama-backend-shared/dispatch"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const (
	groupManagePermission = "group.manage"
	giveGroupTagAction    = "instance.group_tag.give"
	takeGroupTagAction    = "instance.group_tag.take"
	disableGroupAction    = "instance.group.disable"
	enableGroupAction     = "instance.group.enable"
)

func (d *Deps) groupAdministered(ctx context.Context, instanceID, action string) error {
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return agencies.ErrInstanceNotFound
	}
	role, err := d.Registry.RoleOf(ctx, instanceID, caller)
	if err != nil || !slices.Contains([]string{agencies.RoleOwner, agencies.RoleAgent, agencies.RoleResident}, role) {
		return agencies.ErrInstanceNotFound
	}
	if d.callerAdministersAssumedGroup(withPartitionContext(ctx, instanceID), instanceID, caller) {
		return nil
	}
	return fmt.Errorf("%w: you need the permission %q in the group you logged in as to do this (%s); ask the owner to give it to one of your roles there", dispatch.ErrForbidden, groupManagePermission, action)
}

func (d *Deps) callerAdministersAssumedGroup(ctx context.Context, instanceID, caller string) bool {
	seats, err := agencies.SeatsInAssumedGroup(ctx, d.Registry, instanceID, caller)
	if err != nil {
		return false
	}
	if slices.ContainsFunc(seats, agencies.IsFirstGroupAdministration) {
		return true
	}
	codes, err := d.callerRolePermissionCodes(ctx, instanceID)
	return err == nil && slices.Contains(codes, groupManagePermission)
}
