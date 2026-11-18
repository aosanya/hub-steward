package mwanachamacatalog

import (
	"context"
	"strings"
)

type AreaDirectory interface {
	AreasOf(ctx context.Context, personIDs []string) (map[string]string, error)
	Areas(ctx context.Context) ([]AreaPopulation, error)
}

func (m *catalogManager) UseAreaDirectory(directory AreaDirectory) {
	m.directory = directory
}

func (m *catalogManager) TallyBoardItemsByArea(ctx context.Context, boardItemID string) ([]BoardItemAreaTally, error) {
	if !m.keepsBoard() {
		return nil, ErrBoardNotKept
	}
	items, err := m.visibleBoardItems(ctx, boardItemID)
	if err != nil || len(items) == 0 {
		return []BoardItemAreaTally{}, err
	}
	backing, err := m.backingOf(ctx, items)
	if err != nil {
		return nil, err
	}
	listed, placed, err := m.placements(ctx, backing)
	if err != nil {
		return nil, err
	}
	out := make([]BoardItemAreaTally, 0, len(items))
	for _, item := range items {
		out = append(out, BoardItemAreaTally{ID: item.ID, Title: item.Title, Areas: backing.tallyOf(item.ID, listed, placed)})
	}
	return out, nil
}

func (m *catalogManager) visibleBoardItems(ctx context.Context, boardItemID string) ([]BoardItem, error) {
	q := m.q(ctx, roleBoardItem).Where("hidden = ?", false).Order("created_at, id")
	if boardItemID != "" {
		q = q.Where("id = ?", boardItemID)
	}
	return listOf[BoardItem](m, q, roleBoardItem)
}

func (m *catalogManager) placements(ctx context.Context, b boardBacking) ([]AreaPopulation, placing, error) {
	if m.directory == nil {
		return nil, b.placing(nil), nil
	}
	listed, err := m.directory.Areas(ctx)
	if err != nil {
		return nil, nil, err
	}
	known := map[string]string{}
	if ids := b.personIDs(); len(ids) > 0 {
		if known, err = m.directory.AreasOf(ctx, ids); err != nil {
			return nil, nil, err
		}
	}
	return listed, b.placing(known), nil
}

func trimmedArea(area string) string {
	return strings.TrimSpace(area)
}
