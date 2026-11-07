package mwanachamacatalog

import (
	"context"
	"sort"
	"strings"

	"wakalaserver/modules/shared/geo"
)

type AreaResolver func(ctx context.Context, pin *geo.Position, address string) (string, error)

type StreetResolver func(ctx context.Context, pin *geo.Position, address string) (string, error)

const nearbyRaisedItemsCap = 200

func (m *catalogManager) UseAreaResolver(resolve AreaResolver) {
	m.resolveArea = resolve
}

func (m *catalogManager) UseStreetResolver(resolve StreetResolver) {
	m.resolveStreet = resolve
}

func (m *catalogManager) streetOf(ctx context.Context, r RaisedItem) (string, error) {
	if m.resolveStreet == nil {
		return r.Street, nil
	}
	if r.Address != "" {
		street, err := m.resolveStreet(ctx, nil, r.Address)
		if err != nil || street != "" {
			return street, err
		}
	}
	if r.Pin != nil {
		at := r.Pin.Point
		street, err := m.resolveStreet(ctx, &at, "")
		if err != nil || street != "" {
			return street, err
		}
	}
	return r.Street, nil
}

func (m *catalogManager) derivedArea(ctx context.Context, pin *geo.Geometry, address string) (string, error) {
	if m.resolveArea == nil {
		return "", nil
	}
	if pin != nil {
		at := pin.Point
		area, err := m.resolveArea(ctx, &at, "")
		if err != nil || area != "" {
			return area, err
		}
	}
	if address != "" {
		return m.resolveArea(ctx, nil, address)
	}
	return "", nil
}

func (m *catalogManager) placeOf(ctx context.Context, r RaisedItem) (string, string, error) {
	typed := strings.TrimSpace(r.Area)
	derived, err := m.derivedArea(ctx, r.Pin, r.Address)
	if err != nil {
		return "", "", err
	}
	if typed == "" {
		return derived, "", nil
	}
	if derived != "" && !strings.EqualFold(derived, typed) {
		return typed, derived, nil
	}
	return typed, "", nil
}

func (m *catalogManager) NearbyRaisedItems(ctx context.Context, topic string, at geo.Position, withinMetres float64) ([]RaisedItem, error) {
	if !m.takesRaisedItems() {
		return nil, ErrRaisedItemsNotTaken
	}
	if topic == "" || !(withinMetres > 0) {
		return nil, ErrInvalidRaisedItem
	}
	if !m.keepsBoard() {
		return []RaisedItem{}, nil
	}
	shown := m.q(ctx, roleBoardItem).Select("id").Where("hidden = ?", false)
	candidates, err := listOf[RaisedItem](m, m.q(ctx, roleRaisedItem).Where("topic = ? AND publishable = ? AND board_item_id IN (?)", topic, true, shown), roleRaisedItem)
	if err != nil {
		return nil, err
	}
	type near struct {
		item     RaisedItem
		distance float64
	}
	var found []near
	for _, c := range candidates {
		if c.Pin == nil || c.Pin.Kind != geo.KindPoint {
			continue
		}
		if d := geo.Distance(at, c.Pin.Point); d <= withinMetres {
			found = append(found, near{c.AsSeenByOthers(), d})
		}
	}
	sort.SliceStable(found, func(i, j int) bool { return found[i].distance < found[j].distance })
	if len(found) > nearbyRaisedItemsCap {
		found = found[:nearbyRaisedItemsCap]
	}
	out := make([]RaisedItem, len(found))
	for i, n := range found {
		out[i] = n.item
	}
	return out, nil
}
