package digitaltwin

import (
	"context"
	"fmt"
	"strings"
)

func (m *twinManager) CreateLandUse(ctx context.Context, u LandUse) (LandUse, error) {
	if err := m.landUseFits(ctx, u); err != nil {
		return LandUse{}, err
	}
	u.ID = newID()
	u.CreatedAt = m.now()
	if err := m.insert(ctx, roleLandUse, u); err != nil {
		return LandUse{}, err
	}
	return u, nil
}

func (m *twinManager) UpdateLandUse(ctx context.Context, u LandUse) (LandUse, error) {
	held, err := m.GetLandUse(ctx, u.ID)
	if err != nil {
		return LandUse{}, err
	}
	u.CreatedAt = held.CreatedAt
	if err := m.landUseFits(ctx, u); err != nil {
		return LandUse{}, err
	}
	if err := m.update(ctx, roleLandUse, "id", u.ID, u); err != nil {
		return LandUse{}, err
	}
	return u, nil
}

func (m *twinManager) landUseFits(ctx context.Context, u LandUse) error {
	if err := m.checks(roleLandUse, u); err != nil {
		return err
	}
	if strings.TrimSpace(u.PlaceID) == "" && strings.TrimSpace(u.Area) == "" {
		return fmt.Errorf("%w: a land use needs a place_id or an area", ErrInvalid)
	}
	if u.PlaceID != "" {
		if _, err := m.GetNode(ctx, u.PlaceID); err != nil {
			return fmt.Errorf("%w: place_id %q: %v", ErrInvalid, u.PlaceID, err)
		}
	}
	return nil
}

func (m *twinManager) GetLandUse(ctx context.Context, id string) (LandUse, error) {
	var out LandUse
	err := m.take(m.q(ctx, roleLandUse).Where("id = ?", id), roleLandUse, &out, ErrLandUseNotFound)
	return out, err
}

func (m *twinManager) ListLandUses(ctx context.Context, filter LandUseFilter) ([]LandUse, error) {
	q := m.q(ctx, roleLandUse)
	if filter.PlaceID != "" {
		q = q.Where("place_id = ?", filter.PlaceID)
	}
	if filter.Area != "" {
		q = q.Where("area = ?", filter.Area)
	}
	if filter.Zone != "" {
		q = q.Where("zone = ?", filter.Zone)
	}
	return listOf[LandUse](m, q.Order("created_at").Limit(capped(filter.Limit)), roleLandUse)
}
