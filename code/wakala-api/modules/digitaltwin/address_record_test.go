package digitaltwin_test

import (
	"errors"
	"testing"

	digitaltwin "wakalaserver/modules/digitaltwin"
)

func TestAnAddressRecordIsReadBackAsItWasCreated(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	town, err := tm.CreateNode(ctx, digitaltwin.Node{Name: "Szeged", Kind: "street"})
	if err != nil {
		t.Fatal(err)
	}

	made, err := tm.CreateAddress(ctx, digitaltwin.Address{Street: "Fő utca", Number: "12", Area: "Belváros", Postcode: "6720", PlaceID: town.ID})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if made.ID == "" || made.CreatedAt == "" {
		t.Fatalf("the store assigns an id and a created_at, got %+v", made)
	}

	read, err := tm.GetAddress(ctx, made.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if read.Street != "Fő utca" || read.Number != "12" || read.Area != "Belváros" || read.Postcode != "6720" || read.PlaceID != town.ID {
		t.Fatalf("round trip lost something: %+v", read)
	}
}

func TestAddressesAreListedByStreetAreaAndPlace(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	place, err := tm.CreateNode(ctx, digitaltwin.Node{Name: "Fő utca", Kind: "street"})
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range []digitaltwin.Address{
		{Street: "Fő utca", Number: "1", Area: "Belváros", PlaceID: place.ID},
		{Street: "Fő utca", Number: "2", Area: "Újváros"},
		{Street: "Kossuth utca", Number: "3", Area: "Belváros"},
	} {
		if _, err := tm.CreateAddress(ctx, a); err != nil {
			t.Fatal(err)
		}
	}

	cases := []struct {
		name   string
		filter digitaltwin.AddressFilter
		want   int
	}{
		{"every address", digitaltwin.AddressFilter{}, 3},
		{"by street", digitaltwin.AddressFilter{Street: "Fő utca"}, 2},
		{"by area", digitaltwin.AddressFilter{Area: "Belváros"}, 2},
		{"by place", digitaltwin.AddressFilter{PlaceID: place.ID}, 1},
		{"by street and area", digitaltwin.AddressFilter{Street: "Fő utca", Area: "Belváros"}, 1},
	}
	for _, c := range cases {
		got, err := tm.ListAddresses(ctx, c.filter)
		if err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		if len(got) != c.want {
			t.Fatalf("%s: got %d addresses, want %d", c.name, len(got), c.want)
		}
	}
}

func TestAnAddressWithABlankStreetOrNumberIsRefused(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	for _, a := range []digitaltwin.Address{
		{Street: "   ", Number: "1"},
		{Street: "Fő utca", Number: "  "},
	} {
		if _, err := tm.CreateAddress(ctx, a); !errors.Is(err, digitaltwin.ErrInvalid) {
			t.Fatalf("%+v: err = %v, want ErrInvalid", a, err)
		}
	}
}

func TestAnAddressOnAnUnknownPlaceIsRefused(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	_, err := tm.CreateAddress(ctx, digitaltwin.Address{Street: "Fő utca", Number: "1", PlaceID: "no-such-node"})
	if !errors.Is(err, digitaltwin.ErrInvalid) || !errors.Is(err, digitaltwin.ErrNodeNotFound) {
		t.Fatalf("err = %v, want ErrInvalid wrapping ErrNodeNotFound", err)
	}
}

func TestReadingAMissingAddressReportsItIsNotFound(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	if _, err := tm.GetAddress(ctx, "missing"); !errors.Is(err, digitaltwin.ErrAddressNotFound) {
		t.Fatalf("err = %v, want ErrAddressNotFound", err)
	}
}

func TestAnUpdatedAddressIsReadBackChangedAndKeepsItsIdAndCreatedAt(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	made, err := tm.CreateAddress(ctx, digitaltwin.Address{Street: "Fő utca", Number: "12", Area: "Belváros"})
	if err != nil {
		t.Fatal(err)
	}

	updated, err := tm.UpdateAddress(ctx, digitaltwin.Address{ID: made.ID, Street: "Fő utca", Number: "14", Area: "Újváros", Postcode: "6722"})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.ID != made.ID || updated.CreatedAt != made.CreatedAt {
		t.Fatalf("id or created_at changed: %+v then %+v", made, updated)
	}

	read, err := tm.GetAddress(ctx, made.ID)
	if err != nil {
		t.Fatal(err)
	}
	if read.Number != "14" || read.Area != "Újváros" || read.Postcode != "6722" {
		t.Fatalf("the change was not stored: %+v", read)
	}
	all, err := tm.ListAddresses(ctx, digitaltwin.AddressFilter{})
	if err != nil || len(all) != 1 {
		t.Fatalf("an update must not add a record: %d, %v", len(all), err)
	}
}

func TestAnAddressUpdateIsRefusedWhenItBlanksTheStreetOrNamesNoPlace(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	made, err := tm.CreateAddress(ctx, digitaltwin.Address{Street: "Fő utca", Number: "12"})
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range []digitaltwin.Address{
		{ID: made.ID, Street: "  ", Number: "12"},
		{ID: made.ID, Street: "Fő utca", Number: "12", PlaceID: "no-such-node"},
	} {
		if _, err := tm.UpdateAddress(ctx, a); !errors.Is(err, digitaltwin.ErrInvalid) {
			t.Fatalf("%+v: err = %v, want ErrInvalid", a, err)
		}
	}
	read, _ := tm.GetAddress(ctx, made.ID)
	if read.Street != "Fő utca" || read.PlaceID != "" {
		t.Fatalf("a refused update changed the record: %+v", read)
	}
}

func TestUpdatingAMissingAddressReportsItIsNotFound(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	_, err := tm.UpdateAddress(ctx, digitaltwin.Address{ID: "missing", Street: "Fő utca", Number: "1"})
	if !errors.Is(err, digitaltwin.ErrAddressNotFound) {
		t.Fatalf("err = %v, want ErrAddressNotFound", err)
	}
}
