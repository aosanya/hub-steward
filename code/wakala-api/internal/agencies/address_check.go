package agencies

import (
	"context"
	"errors"
	"fmt"
	"strings"

	mwanachamadigitaltwin "github.com/aosanya/mwanachama-backend-digitaltwin"
	mwanachamaforms "wakalaserver/modules/forms"
)

type placesHeld interface {
	GetAddress(ctx context.Context, id string) (mwanachamadigitaltwin.Address, error)
	ListAddresses(ctx context.Context, filter mwanachamadigitaltwin.AddressFilter) ([]mwanachamadigitaltwin.Address, error)
}

func (r *registry) addressCheckIn(instanceID string) mwanachamaforms.AddressCheck {
	return func(ctx context.Context, placeRef string) (bool, error) {
		twin, err := r.TwinManager(ctx, instanceID)
		if err != nil {
			return false, fmt.Errorf("addressCheckIn: %w", err)
		}
		return PlaceIsHeld(ctx, twin, placeRef)
	}
}

func PlaceIsHeld(ctx context.Context, twin placesHeld, placeRef string) (bool, error) {
	if id, ok := strings.CutPrefix(placeRef, "address:"); ok {
		_, err := twin.GetAddress(ctx, id)
		if errors.Is(err, mwanachamadigitaltwin.ErrAddressNotFound) {
			return false, nil
		}
		return err == nil, err
	}
	if street, ok := strings.CutPrefix(placeRef, "street:"); ok {
		held, err := twin.ListAddresses(ctx, mwanachamadigitaltwin.AddressFilter{Street: street, Limit: 1})
		return len(held) > 0, err
	}
	return false, nil
}
