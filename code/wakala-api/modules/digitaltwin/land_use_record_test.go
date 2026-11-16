package digitaltwin_test

import (
	"errors"
	"testing"

	digitaltwin "wakalaserver/modules/digitaltwin"
)

func TestALandUseCanBeRecordedForAPlaceAndReadBack(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	parcel := seedNode(t, tm, ctx, "Plot 7", "parcel")

	made, err := tm.CreateLandUse(ctx, digitaltwin.LandUse{PlaceID: parcel.ID, Zone: "residential", Use: "housing"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if made.ID == "" || made.CreatedAt == "" {
		t.Fatalf("the store assigns an id and a created_at, got %+v", made)
	}

	read, err := tm.GetLandUse(ctx, made.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if read.PlaceID != parcel.ID || read.Zone != "residential" || read.Use != "housing" {
		t.Fatalf("round trip lost something: %+v", read)
	}
}

func TestALandUseCanBeRecordedForANamedArea(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")

	made, err := tm.CreateLandUse(ctx, digitaltwin.LandUse{Area: "Old Town", Zone: "mixed", Use: "shops and flats"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	read, err := tm.GetLandUse(ctx, made.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if read.Area != "Old Town" || read.PlaceID != "" {
		t.Fatalf("round trip lost something: %+v", read)
	}
}

func TestLandUsesListByZoneAreaAndPlace(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	parcel := seedNode(t, tm, ctx, "Plot 7", "parcel")
	for _, u := range []digitaltwin.LandUse{
		{PlaceID: parcel.ID, Zone: "residential", Use: "housing"},
		{Area: "Old Town", Zone: "mixed", Use: "shops"},
		{Area: "Harbour", Zone: "industrial", Use: "docks"},
		{Area: "Old Town", Zone: "residential", Use: "flats"},
	} {
		if _, err := tm.CreateLandUse(ctx, u); err != nil {
			t.Fatalf("create %+v: %v", u, err)
		}
	}

	cases := []struct {
		name   string
		filter digitaltwin.LandUseFilter
		want   int
	}{
		{"everything", digitaltwin.LandUseFilter{}, 4},
		{"by zone", digitaltwin.LandUseFilter{Zone: "residential"}, 2},
		{"by area", digitaltwin.LandUseFilter{Area: "Old Town"}, 2},
		{"by place", digitaltwin.LandUseFilter{PlaceID: parcel.ID}, 1},
		{"by area and zone", digitaltwin.LandUseFilter{Area: "Old Town", Zone: "residential"}, 1},
		{"by a zone nobody uses", digitaltwin.LandUseFilter{Zone: "agricultural"}, 0},
	}
	for _, c := range cases {
		got, err := tm.ListLandUses(ctx, c.filter)
		if err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		if len(got) != c.want {
			t.Fatalf("%s: got %d land uses, want %d", c.name, len(got), c.want)
		}
	}
}

func TestALandUseNamingNeitherPlaceNorAreaIsRefused(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	_, err := tm.CreateLandUse(ctx, digitaltwin.LandUse{Zone: "residential", Use: "housing"})
	if !errors.Is(err, digitaltwin.ErrInvalid) {
		t.Fatalf("err = %v, want ErrInvalid", err)
	}
	_, err = tm.CreateLandUse(ctx, digitaltwin.LandUse{Area: "   ", Zone: "residential", Use: "housing"})
	if !errors.Is(err, digitaltwin.ErrInvalid) {
		t.Fatalf("blank area: err = %v, want ErrInvalid", err)
	}
}

func TestALandUseWithNoZoneIsRefused(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	_, err := tm.CreateLandUse(ctx, digitaltwin.LandUse{Area: "Old Town", Use: "housing"})
	if !errors.Is(err, digitaltwin.ErrInvalid) {
		t.Fatalf("err = %v, want ErrInvalid", err)
	}
}

func TestALandUseForAnUnknownPlaceIsRefused(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	_, err := tm.CreateLandUse(ctx, digitaltwin.LandUse{PlaceID: "no-such-node", Zone: "residential", Use: "housing"})
	if !errors.Is(err, digitaltwin.ErrInvalid) {
		t.Fatalf("err = %v, want ErrInvalid", err)
	}
}

func TestReadingAMissingLandUseGivesNotFound(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	if _, err := tm.GetLandUse(ctx, "missing"); !errors.Is(err, digitaltwin.ErrLandUseNotFound) {
		t.Fatalf("err = %v, want ErrLandUseNotFound", err)
	}
}
