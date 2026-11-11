package mwanachamacatalog

import "context"

func (m *catalogManager) ShowFollowedRaisedItem(ctx context.Context, key string) (FollowedRaisedItemView, error) {
	followed, err := m.OpenFollowedRaisedItem(ctx, key)
	if err != nil {
		return FollowedRaisedItemView{}, err
	}
	return followed.FollowerView(), nil
}
