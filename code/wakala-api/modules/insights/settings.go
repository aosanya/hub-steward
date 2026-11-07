package mwanachamainsights

import (
	"context"
	"fmt"

	"wakalaserver/modules/shared/disclosure"
	"wakalaserver/modules/shared/spec"
)

type SettingsLayers func(ctx context.Context) (definition map[string]any, overrides map[string]spec.Override, err error)

func (m *insightManager) UseSettings(layers SettingsLayers) { m.settings = layers }

func SetMinimumCount(im InsightManager, minimum int) error {
	m, ok := im.(*insightManager)
	if !ok {
		return fmt.Errorf("SetMinimumCount: unsupported manager %T", im)
	}
	if minimum < 2 {
		return disclosure.ErrThreshold
	}
	m.minimum = minimum
	return nil
}

func (m *insightManager) MinimumCount(ctx context.Context) (int, error) {
	if m.minimum >= 2 {
		return m.minimum, nil
	}
	if m.settings == nil {
		return DefaultMinimumCount, nil
	}
	definition, overrides, err := m.settings(ctx)
	if err != nil {
		return 0, fmt.Errorf("MinimumCount: %w", err)
	}
	for _, e := range spec.ResolveAll(m.st.Spec().Settings, definition, overrides) {
		if e.Name != "minimum_count" {
			continue
		}
		switch n := e.Value.(type) {
		case int:
			return atLeastTwo(n), nil
		case int64:
			return atLeastTwo(int(n)), nil
		case float64:
			return atLeastTwo(int(n)), nil
		}
	}
	return DefaultMinimumCount, nil
}

func atLeastTwo(n int) int {
	if n < 2 {
		return DefaultMinimumCount
	}
	return n
}
