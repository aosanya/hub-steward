package http

import (
	"context"
	"fmt"

	"wakalaserver/internal/agencies"
	"wakalaserver/internal/throttle"
)

var (
	errInstanceNameTooLong = fmt.Errorf("an agency's name may be at most %d bytes", throttle.MaxInstanceNameBytes)
	errTooManyInstances    = fmt.Errorf("this account already owns %d agencies; remove or hand one over before registering another", throttle.MaxOwnedInstancesPerCaller)
)

func checkInstanceRoom(ctx context.Context, reg agencies.Registry, caller, name string) error {
	if len(name) > throttle.MaxInstanceNameBytes {
		return errInstanceNameTooLong
	}
	if err := agencies.CheckInstanceName(name); err != nil {
		return err
	}
	held, err := reg.MembershipsFor(ctx, caller)
	if err != nil {
		return err
	}
	owned := 0
	for _, m := range held {
		if m.Role == agencies.RoleOwner {
			owned++
		}
	}
	if owned >= throttle.MaxOwnedInstancesPerCaller {
		return errTooManyInstances
	}
	return nil
}
