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

func TestAnUpdatedTenureIsReadBackChangedAndKeepsItsIdAndCreatedAt(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	place := seedNode(t, tm, ctx, "Plot 12", "place")
	other := seedNode(t, tm, ctx, "Plot 13", "place")
	made, err := tm.CreateTenure(ctx, digitaltwin.Tenure{PlaceID: place.ID, Holder: "amina", Kind: "tenant", Since: "2026-01-15"})
	if err != nil {
		t.Fatal(err)
	}

	updated, err := tm.UpdateTenure(ctx, digitaltwin.Tenure{ID: made.ID, PlaceID: other.ID, Holder: "juma", Kind: "owner", Since: "2026-03-01"})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.ID != made.ID || updated.CreatedAt != made.CreatedAt {
		t.Fatalf("id or created_at changed: %+v then %+v", made, updated)
	}
	read, err := tm.GetTenure(ctx, made.ID)
	if err != nil {
		t.Fatal(err)
	}
	if read.PlaceID != other.ID || read.Holder != "juma" || read.Kind != "owner" || read.Since != "2026-03-01" {
		t.Fatalf("the change was not stored: %+v", read)
	}
	all, err := tm.ListTenures(ctx, digitaltwin.TenureFilter{})
	if err != nil || len(all) != 1 {
		t.Fatalf("an update must not add a record: %d, %v", len(all), err)
	}
}

func TestATenureUpdateWithoutAKindKeepsTheHeldKind(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	place := seedNode(t, tm, ctx, "Plot 12", "place")
	made, err := tm.CreateTenure(ctx, digitaltwin.Tenure{PlaceID: place.ID, Holder: "amina", Kind: "tenant"})
	if err != nil {
		t.Fatal(err)
	}
	updated, err := tm.UpdateTenure(ctx, digitaltwin.Tenure{ID: made.ID, PlaceID: place.ID, Holder: "amina b"})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Kind != "tenant" || updated.Holder != "amina b" {
		t.Fatalf("got %+v", updated)
	}
}

func TestATenureUpdateIsRefusedForAnUnknownPlaceOrABadDateOrKind(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	place := seedNode(t, tm, ctx, "Plot 12", "place")
	made, err := tm.CreateTenure(ctx, digitaltwin.Tenure{PlaceID: place.ID, Holder: "amina", Kind: "tenant", Since: "2026-01-15"})
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range []digitaltwin.Tenure{
		{ID: made.ID, PlaceID: "no-such-node", Holder: "amina", Kind: "tenant"},
		{ID: made.ID, PlaceID: place.ID, Holder: "amina", Kind: "tenant", Since: "last spring"},
		{ID: made.ID, PlaceID: place.ID, Holder: "amina", Kind: "landlord"},
		{ID: made.ID, PlaceID: place.ID, Holder: "", Kind: "tenant"},
	} {
		if _, err := tm.UpdateTenure(ctx, c); !errors.Is(err, digitaltwin.ErrInvalid) {
			t.Fatalf("%+v: err = %v, want ErrInvalid", c, err)
		}
	}
	read, _ := tm.GetTenure(ctx, made.ID)
	if read.Since != "2026-01-15" || read.Kind != "tenant" {
		t.Fatalf("a refused update changed the record: %+v", read)
	}
}

func TestUpdatingAMissingTenureReportsItIsNotFound(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	place := seedNode(t, tm, ctx, "Plot 12", "place")
	_, err := tm.UpdateTenure(ctx, digitaltwin.Tenure{ID: "missing", PlaceID: place.ID, Holder: "amina"})
	if !errors.Is(err, digitaltwin.ErrTenureNotFound) {
		t.Fatalf("err = %v, want ErrTenureNotFound", err)
	}
}

const sampleResidentActorID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
const otherResidentActorID = "f6e5d4c3-b2a1-4f0e-9d8c-7b6a5f4e3d2c"

func TestATenureCreatedWithAHolderActorIdIsReadBackWithIt(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	place := seedNode(t, tm, ctx, "Plot 12", "place")

	made, err := tm.CreateTenure(ctx, digitaltwin.Tenure{PlaceID: place.ID, Holder: "Sample Resident", HolderActorID: sampleResidentActorID, Kind: "tenant"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if made.HolderActorID != sampleResidentActorID {
		t.Fatalf("created tenure holder_actor_id = %q", made.HolderActorID)
	}

	got, err := tm.GetTenure(ctx, made.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.HolderActorID != sampleResidentActorID || got.Holder != "Sample Resident" {
		t.Fatalf("read back %+v", got)
	}
}

func TestListTenuresFiltersByHolderActorIdAndNeverReturnsBodyHolders(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	place := seedNode(t, tm, ctx, "Plot 12", "place")
	byActor, err := tm.CreateTenure(ctx, digitaltwin.Tenure{PlaceID: place.ID, Holder: "Sample Resident", HolderActorID: sampleResidentActorID, Kind: "tenant"})
	if err != nil {
		t.Fatal(err)
	}
	byBody, err := tm.CreateTenure(ctx, digitaltwin.Tenure{PlaceID: place.ID, Holder: "Zöldhalom Parish", Kind: "owner"})
	if err != nil {
		t.Fatal(err)
	}

	mine, err := tm.ListTenures(ctx, digitaltwin.TenureFilter{HolderActorID: sampleResidentActorID})
	if err != nil {
		t.Fatalf("list by actor: %v", err)
	}
	if len(mine) != 1 || mine[0].ID != byActor.ID {
		t.Fatalf("by actor: %+v, want only %s", mine, byActor.ID)
	}

	others, err := tm.ListTenures(ctx, digitaltwin.TenureFilter{HolderActorID: otherResidentActorID})
	if err != nil {
		t.Fatalf("list by other actor: %v", err)
	}
	if len(others) != 0 {
		t.Fatalf("a different actor id returned %+v", others)
	}

	parish, err := tm.ListTenures(ctx, digitaltwin.TenureFilter{Holder: "Zöldhalom Parish"})
	if err != nil {
		t.Fatalf("list by body holder: %v", err)
	}
	if len(parish) != 1 || parish[0].ID != byBody.ID || parish[0].HolderActorID != "" {
		t.Fatalf("by body holder: %+v, want only %s", parish, byBody.ID)
	}
}

func TestTheHolderActorIdFilterCombinesWithPlaceAndKind(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	a := seedNode(t, tm, ctx, "Plot A", "place")
	b := seedNode(t, tm, ctx, "Plot B", "place")
	for _, v := range []digitaltwin.Tenure{
		{PlaceID: a.ID, Holder: "Sample Resident", HolderActorID: sampleResidentActorID, Kind: "owner"},
		{PlaceID: a.ID, Holder: "Sample Resident", HolderActorID: sampleResidentActorID, Kind: "tenant"},
		{PlaceID: b.ID, Holder: "Sample Resident", HolderActorID: sampleResidentActorID, Kind: "tenant"},
		{PlaceID: a.ID, Holder: "Other Resident", HolderActorID: otherResidentActorID, Kind: "tenant"},
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
		{"by actor", digitaltwin.TenureFilter{HolderActorID: sampleResidentActorID}, 3},
		{"by actor and place", digitaltwin.TenureFilter{HolderActorID: sampleResidentActorID, PlaceID: a.ID}, 2},
		{"by actor and kind", digitaltwin.TenureFilter{HolderActorID: sampleResidentActorID, Kind: "tenant"}, 2},
		{"by actor and place and kind", digitaltwin.TenureFilter{HolderActorID: sampleResidentActorID, PlaceID: b.ID, Kind: "tenant"}, 1},
		{"by actor and a place they hold nothing at", digitaltwin.TenureFilter{HolderActorID: otherResidentActorID, PlaceID: b.ID}, 0},
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

func TestATenureUpdateStoresTheHolderActorIdAndAnUpdateWithoutItClearsIt(t *testing.T) {
	tm, ctx := newManagerFor(t, "place")
	place := seedNode(t, tm, ctx, "Plot 12", "place")
	made, err := tm.CreateTenure(ctx, digitaltwin.Tenure{PlaceID: place.ID, Holder: "Zöldhalom Parish", Kind: "owner"})
	if err != nil {
		t.Fatal(err)
	}

	set, err := tm.UpdateTenure(ctx, digitaltwin.Tenure{ID: made.ID, PlaceID: place.ID, Holder: "Sample Resident", HolderActorID: sampleResidentActorID, Kind: "owner"})
	if err != nil {
		t.Fatalf("update with actor id: %v", err)
	}
	if set.HolderActorID != sampleResidentActorID {
		t.Fatalf("updated tenure holder_actor_id = %q", set.HolderActorID)
	}
	read, err := tm.GetTenure(ctx, made.ID)
	if err != nil {
		t.Fatal(err)
	}
	if read.HolderActorID != sampleResidentActorID {
		t.Fatalf("the actor id was not stored: %+v", read)
	}
	listed, err := tm.ListTenures(ctx, digitaltwin.TenureFilter{HolderActorID: sampleResidentActorID})
	if err != nil || len(listed) != 1 || listed[0].ID != made.ID {
		t.Fatalf("after the update the actor filter returned %+v, %v", listed, err)
	}

	if _, err := tm.UpdateTenure(ctx, digitaltwin.Tenure{ID: made.ID, PlaceID: place.ID, Holder: "Zöldhalom Parish", Kind: "owner"}); err != nil {
		t.Fatalf("update without actor id: %v", err)
	}
	cleared, err := tm.GetTenure(ctx, made.ID)
	if err != nil {
		t.Fatal(err)
	}
	if cleared.HolderActorID != "" {
		t.Fatalf("an update without holder_actor_id must clear it: %+v", cleared)
	}
	none, err := tm.ListTenures(ctx, digitaltwin.TenureFilter{HolderActorID: sampleResidentActorID})
	if err != nil || len(none) != 0 {
		t.Fatalf("after clearing the actor filter returned %+v, %v", none, err)
	}
}
