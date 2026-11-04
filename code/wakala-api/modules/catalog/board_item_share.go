package mwanachamacatalog

import (
	"context"
	"errors"
)

func (m *catalogManager) OpenSharedBoardItem(ctx context.Context, key string) (SharedBoardItem, error) {
	if !m.keepsBoard() || key == "" {
		return SharedBoardItem{}, ErrBoardItemNotFound
	}
	var b BoardItem
	if err := m.take(m.q(ctx, roleBoardItem).Where("id = ?", key), roleBoardItem, &b, ErrBoardItemNotFound); err != nil {
		if errors.Is(err, ErrBoardItemNotFound) {
			return SharedBoardItem{}, ErrBoardItemNotFound
		}
		return SharedBoardItem{}, err
	}
	if b.Hidden {
		return SharedBoardItem{}, ErrBoardItemNotFound
	}
	grouped, err := listOf[RaisedItem](m, m.q(ctx, roleRaisedItem).Where("board_item_id = ? AND publishable = ?", b.ID, true).Order("created_at, id"), roleRaisedItem)
	if err != nil {
		return SharedBoardItem{}, err
	}
	if len(grouped) == 0 {
		return SharedBoardItem{}, ErrBoardItemNotFound
	}
	shared := SharedBoardItem{Title: b.Title, Theme: grouped[0].Topic, Area: grouped[0].Area, Status: b.Outcome}
	if shared.Files, err = m.publishedFilesOf(ctx, grouped); err != nil {
		return SharedBoardItem{}, err
	}
	if m.countsEndorsements() {
		if shared.MeToo, err = m.CountEndorsements(ctx, b.ID); err != nil {
			return SharedBoardItem{}, err
		}
	}
	return shared, nil
}
