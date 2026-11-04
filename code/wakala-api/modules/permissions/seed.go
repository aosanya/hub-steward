package mwanachamapermissions

import (
	"context"
	"fmt"
	"sort"

	"wakalaserver/modules/shared/dispatch"
)

func DeclaredActions(operations ...[]byte) ([]string, error) {
	seen := map[string]bool{}
	for i, raw := range operations {
		s, err := dispatch.Parse(raw)
		if err != nil {
			return nil, fmt.Errorf("permissions: declared actions: operations %d: %w", i, err)
		}
		for name, op := range s.Operations {
			if op.Action == "" {
				return nil, fmt.Errorf("permissions: declared actions: operation %q names no action", name)
			}
			if !isAction(op.Action) {
				return nil, fmt.Errorf("%w: %q declares %q", ErrInvalidAction, name, op.Action)
			}
			seen[op.Action] = true
		}
	}
	out := make([]string, 0, len(seen))
	for a := range seen {
		out = append(out, a)
	}
	sort.Strings(out)
	return out, nil
}

func (m *manager) Seed(ctx context.Context, roleCode, name string, operations ...[]byte) ([]RoleAction, error) {
	actions, err := DeclaredActions(operations...)
	if err != nil {
		return nil, err
	}
	if _, err := m.findRole(ctx, roleCode); err != nil {
		if _, err := m.CreateRole(ctx, Role{Code: roleCode, Name: name}); err != nil {
			return nil, err
		}
	}
	return m.SeedActions(ctx, roleCode, actions)
}
