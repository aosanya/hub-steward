package mwanachamacatalog

import (
	"context"
	"errors"

	"wakalaserver/modules/catalog/models"
)

func (m *catalogManager) IssueFollowKey(ctx context.Context, raisedItemID string) (FollowKey, error) {
	if !m.takesRaisedItems() {
		return FollowKey{}, ErrRaisedItemsNotTaken
	}
	var raised RaisedItem
	if err := m.take(m.q(ctx, roleRaisedItem).Where("id = ?", raisedItemID), roleRaisedItem, &raised, ErrRaisedItemNotFound); err != nil {
		return FollowKey{}, err
	}
	raw, err := newShareKey()
	if err != nil {
		return FollowKey{}, err
	}
	if err := m.q(ctx, roleRaisedItem).Where("id = ?", raised.ID).Update("follow_key_hash", models.HashKey(raw)).Error; err != nil {
		return FollowKey{}, err
	}
	return FollowKey{RaisedItemID: raised.ID, Key: raw}, nil
}

func (m *catalogManager) OpenFollowedRaisedItem(ctx context.Context, key string) (FollowedRaisedItem, error) {
	if !m.takesRaisedItems() || key == "" {
		return FollowedRaisedItem{}, ErrRaisedItemNotFound
	}
	var raised RaisedItem
	if err := m.take(m.q(ctx, roleRaisedItem).Where("follow_key_hash = ? AND follow_key_hash <> ''", models.HashKey(key)), roleRaisedItem, &raised, ErrRaisedItemNotFound); err != nil {
		if errors.Is(err, ErrRaisedItemNotFound) {
			return FollowedRaisedItem{}, ErrRaisedItemNotFound
		}
		return FollowedRaisedItem{}, err
	}
	status, err := m.statusOf(ctx, raised)
	if err != nil {
		return FollowedRaisedItem{}, err
	}
	followed := FollowedRaisedItem{Item: raised, Status: status, Replies: []Reply{}}
	if m.sendsReplies() {
		replies, err := m.ListReplies(ctx, raised.ID)
		if err != nil {
			return FollowedRaisedItem{}, err
		}
		followed.Replies = replies
	}
	return followed, nil
}
