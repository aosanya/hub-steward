package mwanachamacatalog

import "context"

type LinkedEntries func(ctx context.Context, caller string) ([]string, error)

func (m *catalogManager) UseLinkedEntries(linked LinkedEntries) {
	m.linkedEntries = linked
}

func (m *catalogManager) entriesLinkedTo(ctx context.Context, caller string) ([]string, error) {
	if m.linkedEntries == nil {
		return nil, nil
	}
	ids, err := m.linkedEntries(ctx, caller)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if id != "" {
			out = append(out, id)
		}
	}
	return out, nil
}
