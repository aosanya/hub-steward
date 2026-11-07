package http

import (
	"context"

	"wakalaserver/internal/agencies"
)

func ConsentRequired(registry func() agencies.Registry) agencies.ConsentRequiredOf {
	return func(ctx context.Context, instanceID string) (bool, error) {
		reg := registry()
		if reg == nil {
			return false, nil
		}
		set, err := mountedSetOf(ctx, reg, instanceID)
		if err != nil {
			return false, err
		}
		return !set.ungated && set.modules["custody"], nil
	}
}

func ModuleMounted(registry func() agencies.Registry) agencies.ModuleMountedOf {
	return func(ctx context.Context, instanceID, module string) (bool, error) {
		reg := registry()
		if reg == nil {
			return false, nil
		}
		set, err := mountedSetOf(ctx, reg, instanceID)
		if err != nil {
			return false, err
		}
		return set.ungated || set.modules[module], nil
	}
}
