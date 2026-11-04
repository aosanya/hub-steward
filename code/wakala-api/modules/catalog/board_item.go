package mwanachamacatalog

import "context"

func (m *catalogManager) keepsBoard() bool {
	_, boarded := m.st.Spec().ByRole(roleBoardItem)
	return boarded && m.takesRaisedItems()
}

func (m *catalogManager) PutOnBoard(ctx context.Context, b BoardItem) (BoardItem, error) {
	if !m.keepsBoard() {
		return BoardItem{}, ErrBoardNotKept
	}
	if err := m.checks(roleBoardItem, b); err != nil {
		return BoardItem{}, ErrInvalidBoardItem
	}
	b.ID = newID()
	b.AssigneeKind, b.AssigneeID, b.ClosedAt, b.ClosedBy = "", "", "", ""
	b.CreatedAt = m.now()
	row, err := encode(m.st.Object(roleBoardItem), b)
	if err != nil {
		return BoardItem{}, err
	}
	if err := m.q(ctx, roleBoardItem).Create(row).Error; err != nil {
		return BoardItem{}, err
	}
	return b, nil
}

func (m *catalogManager) GroupUnderBoardItem(ctx context.Context, raisedItemID, boardItemID string) error {
	if !m.keepsBoard() {
		return ErrBoardNotKept
	}
	if raisedItemID == "" || boardItemID == "" {
		return ErrInvalidBoardItem
	}
	var b BoardItem
	if err := m.take(m.q(ctx, roleBoardItem).Where("id = ?", boardItemID), roleBoardItem, &b, ErrBoardItemNotFound); err != nil {
		return err
	}
	var r RaisedItem
	if err := m.take(m.q(ctx, roleRaisedItem).Where("id = ?", raisedItemID), roleRaisedItem, &r, ErrRaisedItemNotFound); err != nil {
		return err
	}
	if !r.Publishable {
		return ErrRaisedItemNotPublishable
	}
	return m.q(ctx, roleRaisedItem).Where("id = ?", raisedItemID).Update("board_item_id", boardItemID).Error
}

func (m *catalogManager) ListBoardItems(ctx context.Context) ([]BoardItemTally, error) {
	if !m.keepsBoard() {
		return nil, ErrBoardNotKept
	}
	items, err := listOf[BoardItem](m, m.q(ctx, roleBoardItem).Where("hidden = ?", false).Order("created_at, id"), roleBoardItem)
	if err != nil {
		return nil, err
	}
	out := make([]BoardItemTally, 0, len(items))
	for _, b := range items {
		t := BoardItemTally{BoardItem: b}
		var n int64
		if err := m.q(ctx, roleRaisedItem).Where("board_item_id = ? AND publishable = ?", b.ID, true).Count(&n).Error; err != nil {
			return nil, err
		}
		t.RaisedBy = int(n)
		if m.countsEndorsements() {
			if t.MeToo, err = m.CountEndorsements(ctx, b.ID); err != nil {
				return nil, err
			}
		}
		out = append(out, t)
	}
	return out, nil
}

const MaxPublicBoardPage = 50

func (m *catalogManager) ListPublicBoardItems(ctx context.Context, limit, offset int) ([]BoardItemTally, error) {
	if limit <= 0 || limit > MaxPublicBoardPage {
		limit = MaxPublicBoardPage
	}
	if offset < 0 {
		offset = 0
	}
	all, err := m.ListBoardItems(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]BoardItemTally, 0, len(all))
	for _, t := range all {
		if t.RaisedBy > 0 {
			out = append(out, t)
		}
	}
	if offset >= len(out) {
		return []BoardItemTally{}, nil
	}
	out = out[offset:]
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func (m *catalogManager) SetBoardItemOutcome(ctx context.Context, boardItemID, outcome string) error {
	if !m.keepsBoard() {
		return ErrBoardNotKept
	}
	if boardItemID == "" {
		return ErrInvalidBoardItem
	}
	res := m.q(ctx, roleBoardItem).Where("id = ?", boardItemID).Update("outcome", outcome)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrBoardItemNotFound
	}
	return nil
}

func (m *catalogManager) UngroupFromBoardItem(ctx context.Context, raisedItemID string) error {
	if !m.keepsBoard() {
		return ErrBoardNotKept
	}
	if raisedItemID == "" {
		return ErrInvalidBoardItem
	}
	res := m.q(ctx, roleRaisedItem).Where("id = ?", raisedItemID).Update("board_item_id", "")
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrRaisedItemNotFound
	}
	return nil
}

func (m *catalogManager) SetBoardItemHidden(ctx context.Context, boardItemID string, hidden bool) error {
	if !m.keepsBoard() {
		return ErrBoardNotKept
	}
	if boardItemID == "" {
		return ErrInvalidBoardItem
	}
	var b BoardItem
	if err := m.take(m.q(ctx, roleBoardItem).Where("id = ?", boardItemID), roleBoardItem, &b, ErrBoardItemNotFound); err != nil {
		return err
	}
	return m.q(ctx, roleBoardItem).Where("id = ?", boardItemID).Update("hidden", hidden).Error
}
