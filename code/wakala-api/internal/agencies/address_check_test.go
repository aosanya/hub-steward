package agencies

import (
	"context"
	"testing"

	mwanachamadigitaltwin "wakalaserver/modules/digitaltwin"
)

type townAddresses []mwanachamadigitaltwin.Address

func (t townAddresses) GetAddress(_ context.Context, id string) (mwanachamadigitaltwin.Address, error) {
	for _, a := range t {
		if a.ID == id {
			return a, nil
		}
	}
	return mwanachamadigitaltwin.Address{}, mwanachamadigitaltwin.ErrAddressNotFound
}

func (t townAddresses) ListAddresses(_ context.Context, f mwanachamadigitaltwin.AddressFilter) ([]mwanachamadigitaltwin.Address, error) {
	out := []mwanachamadigitaltwin.Address{}
	for _, a := range t {
		if f.Street == "" || a.Street == f.Street {
			out = append(out, a)
		}
	}
	return out, nil
}

func TestAPlaceIsHeldOnlyWhenTheTownListsTheAddressOrTheStreet(t *testing.T) {
	town := townAddresses{{ID: "a-1", Street: "Fő tér", Number: "2"}}
	cases := []struct {
		ref  string
		want bool
	}{
		{"address:a-1", true},
		{"address:nowhere", false},
		{"street:Fő tér", true},
		{"street:x", false},
		{"house:a-1", false},
		{"", false},
	}
	for _, c := range cases {
		got, err := PlaceIsHeld(context.Background(), town, c.ref)
		if err != nil || got != c.want {
			t.Errorf("%q: held = %v (%v), want %v", c.ref, got, err, c.want)
		}
	}
}
