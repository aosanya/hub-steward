package mwanachamacatalog

import (
	"context"
	"fmt"

	"wakalaserver/modules/shared/spec"
)

func resolveFitting[T any](ctx context.Context, m *catalogManager, name string, parse func(any) (T, error)) (T, error) {
	var zero T
	definition, overrides, err := spec.LoadSettingLayers(m.db.WithContext(ctx), m.spec)
	if err != nil {
		return zero, fmt.Errorf("catalog: %s: %w", name, err)
	}
	effective, err := spec.Resolve(m.spec.Settings, definition, overrides, name)
	if err != nil {
		return zero, fmt.Errorf("catalog: %s: %w", name, err)
	}
	parsed, err := parse(effective.Value)
	if err == nil || effective.Layer != spec.LayerOverride {
		return parsed, err
	}
	fallback, err := spec.Resolve(m.spec.Settings, definition, nil, name)
	if err != nil {
		return zero, fmt.Errorf("catalog: %s: %w", name, err)
	}
	return parse(fallback.Value)
}
