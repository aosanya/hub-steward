package voting

import (
	"context"
	"fmt"

	"wakalaserver/modules/shared/spec"
)

type SettingsLayers func(ctx context.Context) (definition map[string]any, overrides map[string]spec.Override, err error)

type Settings struct {
	Mode          string           `json:"mode"`
	MaxChoices    int              `json:"max_choices,omitempty"`
	Budget        int              `json:"budget,omitempty"`
	ChangeAllowed bool             `json:"change_allowed"`
	PerGroup      string           `json:"per_group"`
	MinimumCount  int              `json:"minimum_count"`
	Effective     []spec.Effective `json:"effective"`
}

func (m *pollManager) UseSettings(layers SettingsLayers) { m.settings = layers }

func (m *pollManager) Settings(ctx context.Context) (Settings, error) {
	var definition map[string]any
	var overrides map[string]spec.Override
	if m.settings != nil {
		var err error
		definition, overrides, err = m.settings(ctx)
		if err != nil {
			return Settings{}, fmt.Errorf("Settings: %w", err)
		}
	}
	out := Settings{Effective: spec.ResolveAll(m.spec.Settings, definition, overrides)}
	for _, e := range out.Effective {
		switch e.Name {
		case "mode":
			out.Mode, _ = e.Value.(string)
		case "per_group":
			out.PerGroup, _ = e.Value.(string)
		case "change_allowed":
			out.ChangeAllowed, _ = e.Value.(bool)
		case "max_choices":
			out.MaxChoices = wholeNumber(e.Value)
		case "minimum_count":
			out.MinimumCount = wholeNumber(e.Value)
		case "budget":
			out.Budget = wholeNumber(e.Value)
		}
	}
	return out, nil
}

func (m *pollManager) startFromSettings(ctx context.Context, in Poll) (Poll, error) {
	s, err := m.Settings(ctx)
	if err != nil {
		return Poll{}, err
	}
	if in.Mode == "" {
		in.Mode = s.Mode
	}
	if in.PerGroup == "" {
		in.PerGroup = s.PerGroup
	}
	if in.MaxChoices == 0 {
		in.MaxChoices = s.MaxChoices
	}
	if in.Budget == 0 {
		in.Budget = s.Budget
	}
	return in, nil
}

func wholeNumber(v any) int {
	switch n := v.(type) {
	case int:
		return n
	case int64:
		return int(n)
	case float64:
		return int(n)
	}
	return 0
}
