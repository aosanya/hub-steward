package digitaltwin

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

func (m *twinManager) CreateAddress(ctx context.Context, a Address) (Address, error) {
	if err := m.addressFits(ctx, a); err != nil {
		return Address{}, err
	}
	a.ID = newID()
	a.CreatedAt = m.now()
	if err := m.insert(ctx, roleAddress, a); err != nil {
		return Address{}, err
	}
	return a, nil
}

func (m *twinManager) UpdateAddress(ctx context.Context, a Address) (Address, error) {
	held, err := m.GetAddress(ctx, a.ID)
	if err != nil {
		return Address{}, err
	}
	a.CreatedAt = held.CreatedAt
	if err := m.addressFits(ctx, a); err != nil {
		return Address{}, err
	}
	if err := m.update(ctx, roleAddress, "id", a.ID, a); err != nil {
		return Address{}, err
	}
	return a, nil
}

func (m *twinManager) addressFits(ctx context.Context, a Address) error {
	if err := m.checks(roleAddress, a); err != nil {
		return err
	}
	if strings.TrimSpace(a.Street) == "" || strings.TrimSpace(a.Number) == "" {
		return fmt.Errorf("%w: an address needs a street and a number", ErrInvalid)
	}
	if a.PlaceID != "" {
		if _, err := m.GetNode(ctx, a.PlaceID); err != nil {
			if errors.Is(err, ErrNodeNotFound) {
				return fmt.Errorf("%w: place_id %q names no node: %w", ErrInvalid, a.PlaceID, err)
			}
			return err
		}
	}
	return nil
}

func (m *twinManager) GetAddress(ctx context.Context, id string) (Address, error) {
	var out Address
	err := m.take(m.q(ctx, roleAddress).Where("id = ?", id), roleAddress, &out, ErrAddressNotFound)
	return out, err
}

func (m *twinManager) ListAddresses(ctx context.Context, filter AddressFilter) ([]Address, error) {
	q := m.q(ctx, roleAddress)
	if filter.Street != "" {
		q = q.Where("street = ?", filter.Street)
	}
	if filter.Area != "" {
		q = q.Where("area = ?", filter.Area)
	}
	if filter.PlaceID != "" {
		q = q.Where("place_id = ?", filter.PlaceID)
	}
	return listOf[Address](m, q.Order("created_at").Limit(capped(filter.Limit)), roleAddress)
}
