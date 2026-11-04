package mcp

import "fmt"

func (p mcpDesignFromSpecParams) duplicateKeyError() error {
	sections := []struct {
		name string
		keys []string
	}{
		{"roles", specKeys(p.Roles, func(r specRole) string { return r.Key })},
		{"goals", specKeys(p.Goals, func(g specGoal) string { return g.Key })},
		{"objectives", specKeys(p.Objectives, func(o specObjective) string { return o.Key })},
		{"workflows", specKeys(p.Workflows, func(w specWorkflow) string { return w.Key })},
		{"work_items", specKeys(p.WorkItems, func(w specWorkItem) string { return w.Key })},
	}
	for _, section := range sections {
		seen := map[string]bool{}
		for _, key := range section.keys {
			if key != "" && seen[key] {
				return fmt.Errorf("design spec refused: %s key %q is used by more than one entry, so a reference to it could not say which; give each entry its own key", section.name, key)
			}
			seen[key] = true
		}
	}
	return nil
}

func specKeys[T any](entries []T, key func(T) string) []string {
	out := make([]string, len(entries))
	for i, e := range entries {
		out[i] = key(e)
	}
	return out
}
