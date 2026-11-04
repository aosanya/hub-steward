package mwanachamacatalog

import (
	"context"
	"strings"

	"gorm.io/gorm"
)

func (m *catalogManager) makesRemovals() bool {
	_, removes := m.st.Spec().ByRole(roleRemoval)
	return removes && m.takesRaisedItems()
}

func (m *catalogManager) RemoveRaisedItem(ctx context.Context, r Removal) (Removal, error) {
	if !m.makesRemovals() {
		return Removal{}, ErrRemovalsNotMade
	}
	if strings.TrimSpace(r.Ground) == "" || strings.TrimSpace(r.RemovedBy) == "" {
		return Removal{}, ErrInvalidRemoval
	}
	if err := m.checks(roleRemoval, r); err != nil {
		return Removal{}, ErrInvalidRemoval
	}
	r.ID = newID()
	r.CreatedAt = m.now()
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		raisedItems := func() *gorm.DB { return tx.Table(m.st.Table(roleRaisedItem)).Where("id = ?", r.RaisedItemID) }
		var raised RaisedItem
		if err := m.take(raisedItems(), roleRaisedItem, &raised, ErrRaisedItemNotFound); err != nil {
			return err
		}
		var already int64
		if err := tx.Table(m.st.Table(roleRemoval)).Where("raised_item_id = ?", r.RaisedItemID).Count(&already).Error; err != nil {
			return err
		}
		if already > 0 {
			return ErrRaisedItemAlreadyRemoved
		}
		row, err := encode(m.st.Object(roleRemoval), r)
		if err != nil {
			return err
		}
		if err := tx.Table(m.st.Table(roleRemoval)).Create(row).Error; err != nil {
			return err
		}
		return raisedItems().Updates(map[string]any{"publishable": false, "board_item_id": ""}).Error
	})
	if err != nil {
		return Removal{}, err
	}
	return r, nil
}

func (m *catalogManager) ListRemovalsOfMine(ctx context.Context, raisedBy string) ([]Removal, error) {
	if !m.makesRemovals() {
		return nil, ErrRemovalsNotMade
	}
	if raisedBy == "" {
		return nil, ErrInvalidRemoval
	}
	mine := m.q(ctx, roleRaisedItem).Select("id").Where("raised_by = ?", raisedBy)
	return listOf[Removal](m, m.q(ctx, roleRemoval).Where("raised_item_id IN (?)", mine).Order("created_at, id"), roleRemoval)
}
