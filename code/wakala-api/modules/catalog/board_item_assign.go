package mwanachamacatalog

import (
	"context"

	"wakalaserver/modules/catalog/models"
)

func (m *catalogManager) AssignBoardItem(ctx context.Context, boardItemID, assigneeKind, assigneeID string) error {
	if !m.keepsBoard() {
		return ErrBoardNotKept
	}
	if boardItemID == "" || !models.IsAssigneeKind(assigneeKind) || assigneeID == "" {
		return ErrInvalidBoardItem
	}
	return m.updateOpenBoardItem(ctx, boardItemID, map[string]any{"assignee_kind": assigneeKind, "assignee_id": assigneeID})
}

func (m *catalogManager) UnassignBoardItem(ctx context.Context, boardItemID string) error {
	if !m.keepsBoard() {
		return ErrBoardNotKept
	}
	if boardItemID == "" {
		return ErrInvalidBoardItem
	}
	return m.updateBoardItem(ctx, boardItemID, map[string]any{"assignee_kind": "", "assignee_id": ""})
}

func (m *catalogManager) CloseBoardItem(ctx context.Context, boardItemID, closedBy string) error {
	if !m.keepsBoard() {
		return ErrBoardNotKept
	}
	if boardItemID == "" || closedBy == "" {
		return ErrInvalidBoardItem
	}
	return m.updateOpenBoardItem(ctx, boardItemID, map[string]any{"closed_at": m.now(), "closed_by": closedBy})
}

func (m *catalogManager) updateOpenBoardItem(ctx context.Context, boardItemID string, cols map[string]any) error {
	res := m.q(ctx, roleBoardItem).Where("id = ? AND closed_at = ?", boardItemID, "").Updates(cols)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 1 {
		return nil
	}
	var b BoardItem
	if err := m.take(m.q(ctx, roleBoardItem).Where("id = ?", boardItemID), roleBoardItem, &b, ErrBoardItemNotFound); err != nil {
		return err
	}
	return ErrBoardItemClosed
}

func (m *catalogManager) updateBoardItem(ctx context.Context, boardItemID string, cols map[string]any) error {
	var b BoardItem
	if err := m.take(m.q(ctx, roleBoardItem).Where("id = ?", boardItemID), roleBoardItem, &b, ErrBoardItemNotFound); err != nil {
		return err
	}
	return m.q(ctx, roleBoardItem).Where("id = ?", boardItemID).Updates(cols).Error
}
