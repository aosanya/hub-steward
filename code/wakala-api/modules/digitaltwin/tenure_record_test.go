package digitaltwin_test

import (
	"errors"
	"testing"

	digitaltwin "wakalaserver/modules/digitaltwin"
)

func TestCreatedTenureIsReadBackWithItsPlaceAndHolder(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	place := seedNode(t, tm, ctx, "Plot 12", "place")

	made, err := tm.CreateTenure(ctx, digitaltwin.Tenure{PlaceID: place.ID, Holder: "amina", Kind: "tenant", Since: "2026-01-15"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if made.ID == "" || made.CreatedAt == "" {
		t.Fatalf("created tenure lacks id or created_at: %+v", made)
	}

	got, err := tm.GetTenure(ctx, made.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.PlaceID != place.ID || got.Holder != "amina" || got.Kind != "tenant" || got.Since != "2026-01-15" {
		t.Fatalf("read back %+v", got)
	}
}

func TestTenureKindDefaultsToOwner(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	place := seedNode(t, tm, ctx, "Plot 12", "place")

	made, err := tm.CreateTenure(ctx, digitaltwin.Tenure{PlaceID: place.ID, Holder: "amina"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if made.Kind != "owner" {
		t.Fatalf("kind = %q, want owner", made.Kind)
	}
}

func TestListTenuresFiltersByPlaceHolderAndKind(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	a := seedNode(t, tm, ctx, "Plot A", "place")
	b := seedNode(t, tm, ctx, "Plot B", "place")
	for _, v := range []digitaltwin.Tenure{
		{PlaceID: a.ID, Holder: "amina", Kind: "owner"},
		{PlaceID: a.ID, Holder: "juma", Kind: "tenant"},
		{PlaceID: b.ID, Holder: "amina", Kind: "tenant"},
	} {
		if _, err := tm.CreateTenure(ctx, v); err != nil {
			t.Fatalf("create %+v: %v", v, err)
		}
	}

	cases := []struct {
		name   string
		filter digitaltwin.TenureFilter
		want   int
	}{
		{"all", digitaltwin.TenureFilter{}, 3},
		{"by place", digitaltwin.TenureFilter{PlaceID: a.ID}, 2},
		{"by holder", digitaltwin.TenureFilter{Holder: "amina"}, 2},
		{"by kind", digitaltwin.TenureFilter{Kind: "tenant"}, 2},
		{"by place and holder and kind", digitaltwin.TenureFilter{PlaceID: b.ID, Holder: "amina", Kind: "tenant"}, 1},
	}
	for _, c := range cases {
		got, err := tm.ListTenures(ctx, c.filter)
		if err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		if len(got) != c.want {
			t.Fatalf("%s: %d tenures, want %d", c.name, len(got), c.want)
		}
	}
}

func TestTenureRefusals(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	place := seedNode(t, tm, ctx, "Plot 12", "place")

	cases := []struct {
		name string
		in   digitaltwin.Tenure
	}{
		{"unknown kind", digitaltwin.Tenure{PlaceID: place.ID, Holder: "amina", Kind: "squatter"}},
		{"missing holder", digitaltwin.Tenure{PlaceID: place.ID}},
		{"missing place", digitaltwin.Tenure{Holder: "amina"}},
		{"unknown place", digitaltwin.Tenure{PlaceID: "no-such-node", Holder: "amina"}},
		{"malformed since", digitaltwin.Tenure{PlaceID: place.ID, Holder: "amina", Since: "last spring"}},
	}
	for _, c := range cases {
		if _, err := tm.CreateTenure(ctx, c.in); !errors.Is(err, digitaltwin.ErrInvalid) {
			t.Fatalf("%s: err = %v, want ErrInvalid", c.name, err)
		}
	}
}

func TestMissingTenureIdGivesErrTenureNotFound(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")

	if _, err := tm.GetTenure(ctx, "nope"); !errors.Is(err, digitaltwin.ErrTenureNotFound) {
		t.Fatalf("err = %v, want ErrTenureNotFound", err)
	}
}
