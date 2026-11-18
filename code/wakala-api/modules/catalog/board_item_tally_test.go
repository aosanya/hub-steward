package mwanachamacatalog_test

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"

	catalog "wakalaserver/modules/catalog"
)

type fakeDirectory struct {
	placed map[string]string
	areas  []catalog.AreaPopulation
	err    error
}

func (d fakeDirectory) AreasOf(_ context.Context, ids []string) (map[string]string, error) {
	if d.err != nil {
		return nil, d.err
	}
	found := map[string]string{}
	for _, id := range ids {
		if area, ok := d.placed[id]; ok {
			found[id] = area
		}
	}
	return found, nil
}

func (d fakeDirectory) Areas(context.Context) ([]catalog.AreaPopulation, error) {
	return d.areas, d.err
}

func threeAreas() []catalog.AreaPopulation {
	return []catalog.AreaPopulation{{Area: "North", Population: 4100}, {Area: "East", Population: 3800}, {Area: "South", Population: 2500}}
}

func population(n int) *int { return &n }

func rowsText(rows []catalog.AreaTally) string {
	var parts []string
	for _, r := range rows {
		pop := "nil"
		if r.Population != nil {
			pop = fmt.Sprint(*r.Population)
		}
		parts = append(parts, fmt.Sprintf("{%q raised_by=%d me_too=%d population=%s}", r.Area, r.RaisedBy, r.MeToo, pop))
	}
	return strings.Join(parts, " ")
}

func putOnBoard(t *testing.T, cm catalog.CatalogManager, title string) catalog.BoardItem {
	t.Helper()
	b, err := cm.PutOnBoard(context.Background(), catalog.BoardItem{Title: title})
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func raiseUnder(t *testing.T, cm catalog.CatalogManager, boardID, who, storedArea string) {
	t.Helper()
	ctx := context.Background()
	r, err := cm.RaiseItem(ctx, catalog.RaisedItem{Title: "Dark road", Publishable: true, RaisedBy: who, Area: storedArea})
	if err != nil {
		t.Fatal(err)
	}
	if err := cm.GroupUnderBoardItem(ctx, r.ID, boardID); err != nil {
		t.Fatal(err)
	}
}

func saidMeToo(t *testing.T, cm catalog.CatalogManager, boardID string, holders ...string) {
	t.Helper()
	for _, h := range holders {
		if _, err := cm.Endorse(context.Background(), boardID, h); err != nil {
			t.Fatal(err)
		}
	}
}

func tallyRows(t *testing.T, cm catalog.CatalogManager, boardID string) []catalog.AreaTally {
	t.Helper()
	got, err := cm.TallyBoardItemsByArea(context.Background(), boardID)
	if err != nil {
		t.Fatalf("tally: %v", err)
	}
	if len(got) != 1 || got[0].ID != boardID {
		t.Fatalf("tally = %+v, want just board item %s", got, boardID)
	}
	return got[0].Areas
}

func wantRows(t *testing.T, got, want []catalog.AreaTally) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Errorf("rows\n got  %s\n want %s", rowsText(got), rowsText(want))
	}
}

func TestEveryAreaTheDirectoryListsIsARowEvenWhenNobodyThereIsBehindTheItem(t *testing.T) {
	cm := entryManager(t)
	cm.UseAreaDirectory(fakeDirectory{areas: threeAreas(), placed: map[string]string{"amina": "North", "baraka": "East"}})
	b := putOnBoard(t, cm, "Streetlights out")
	raiseUnder(t, cm, b.ID, "amina", "")
	raiseUnder(t, cm, b.ID, "baraka", "")
	wantRows(t, tallyRows(t, cm, b.ID), []catalog.AreaTally{
		{Area: "North", RaisedBy: 1, Population: population(4100)},
		{Area: "East", RaisedBy: 1, Population: population(3800)},
		{Area: "South", Population: population(2500)},
	})
}

func TestAPersonWhoRaisedAndSaidMeTooCountsOnceAsARaiser(t *testing.T) {
	cm := entryManager(t)
	cm.UseAreaDirectory(fakeDirectory{areas: threeAreas(), placed: map[string]string{"amina": "North", "baraka": "East", "chiku": "North", "dawit": "East"}})
	b := putOnBoard(t, cm, "Streetlights out")
	raiseUnder(t, cm, b.ID, "amina", "")
	raiseUnder(t, cm, b.ID, "baraka", "")
	saidMeToo(t, cm, b.ID, "amina", "chiku", "dawit")
	wantRows(t, tallyRows(t, cm, b.ID), []catalog.AreaTally{
		{Area: "North", RaisedBy: 1, MeToo: 1, Population: population(4100)},
		{Area: "East", RaisedBy: 1, MeToo: 1, Population: population(3800)},
		{Area: "South", Population: population(2500)},
	})
}

func TestAPersonWhoRaisedTwiceCountsOnce(t *testing.T) {
	cm := entryManager(t)
	cm.UseAreaDirectory(fakeDirectory{areas: threeAreas(), placed: map[string]string{"amina": "North"}})
	b := putOnBoard(t, cm, "Streetlights out")
	raiseUnder(t, cm, b.ID, "amina", "")
	raiseUnder(t, cm, b.ID, "amina", "")
	wantRows(t, tallyRows(t, cm, b.ID), []catalog.AreaTally{
		{Area: "North", RaisedBy: 1, Population: population(4100)},
		{Area: "East", Population: population(3800)},
		{Area: "South", Population: population(2500)},
	})
}

func TestAMeTooHolderTheDirectoryCannotPlaceIsOneRowWithNoAreaLast(t *testing.T) {
	cm := entryManager(t)
	cm.UseAreaDirectory(fakeDirectory{areas: threeAreas(), placed: map[string]string{"chiku": "North"}})
	b := putOnBoard(t, cm, "Streetlights out")
	saidMeToo(t, cm, b.ID, "chiku", "eshe", "farida")
	wantRows(t, tallyRows(t, cm, b.ID), []catalog.AreaTally{
		{Area: "North", MeToo: 1, Population: population(4100)},
		{Area: "East", Population: population(3800)},
		{Area: "South", Population: population(2500)},
		{Area: "", MeToo: 2},
	})
}

func TestARaiserTheDirectoryDoesNotPlaceFallsBackToTheRaisedItemsStoredArea(t *testing.T) {
	cm := entryManager(t)
	cm.UseAreaDirectory(fakeDirectory{areas: threeAreas()})
	b := putOnBoard(t, cm, "Streetlights out")
	raiseUnder(t, cm, b.ID, "register-7", "east")
	raiseUnder(t, cm, b.ID, "register-8", "Westfield")
	raiseUnder(t, cm, b.ID, "register-9", "")
	saidMeToo(t, cm, b.ID, "eshe")
	wantRows(t, tallyRows(t, cm, b.ID), []catalog.AreaTally{
		{Area: "North", Population: population(4100)},
		{Area: "East", RaisedBy: 1, Population: population(3800)},
		{Area: "South", Population: population(2500)},
		{Area: "Westfield", RaisedBy: 1},
		{Area: "", RaisedBy: 1, MeToo: 1},
	})
}

func TestTheDirectoryPlacesARaiserBeforeTheirRaisedItemsStoredArea(t *testing.T) {
	cm := entryManager(t)
	cm.UseAreaDirectory(fakeDirectory{areas: threeAreas(), placed: map[string]string{"amina": "North"}})
	b := putOnBoard(t, cm, "Streetlights out")
	raiseUnder(t, cm, b.ID, "amina", "East")
	wantRows(t, tallyRows(t, cm, b.ID), []catalog.AreaTally{
		{Area: "North", RaisedBy: 1, Population: population(4100)},
		{Area: "East", Population: population(3800)},
		{Area: "South", Population: population(2500)},
	})
}

func TestWithNoDirectoryRaisersSitWhereTheirItemIsAndMeTooHoldersAreUnplacedWithNoPopulation(t *testing.T) {
	cm := entryManager(t)
	b := putOnBoard(t, cm, "Streetlights out")
	raiseUnder(t, cm, b.ID, "amina", "North")
	saidMeToo(t, cm, b.ID, "chiku", "dawit")
	wantRows(t, tallyRows(t, cm, b.ID), []catalog.AreaTally{
		{Area: "North", RaisedBy: 1},
		{Area: "", MeToo: 2},
	})
}

func TestABoardItemWithNothingBehindItStillAppearsWithTheZeroRows(t *testing.T) {
	cm := entryManager(t)
	cm.UseAreaDirectory(fakeDirectory{areas: threeAreas()})
	b := putOnBoard(t, cm, "Market drainage")
	wantRows(t, tallyRows(t, cm, b.ID), []catalog.AreaTally{
		{Area: "North", Population: population(4100)},
		{Area: "East", Population: population(3800)},
		{Area: "South", Population: population(2500)},
	})
}

func TestTheTallyIsNarrowedToOneBoardItemOnlyWhenAskedAndAnswersAllOtherwise(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	cm.UseAreaDirectory(fakeDirectory{areas: threeAreas(), placed: map[string]string{"amina": "North"}})
	first := putOnBoard(t, cm, "Streetlights out")
	second := putOnBoard(t, cm, "Market drainage")
	saidMeToo(t, cm, first.ID, "amina")
	all, err := cm.TallyBoardItemsByArea(ctx, "")
	if err != nil || len(all) != 2 {
		t.Fatalf("all = %+v (%v), want both board items", all, err)
	}
	byID := map[string]catalog.BoardItemAreaTally{}
	for _, item := range all {
		byID[item.ID] = item
	}
	if byID[first.ID].Title != "Streetlights out" || byID[first.ID].Areas[0].MeToo != 1 || byID[second.ID].Areas[0].MeToo != 0 {
		t.Errorf("all = %+v", all)
	}
	one := tallyRows(t, cm, second.ID)
	if len(one) != 3 || one[0].MeToo != 0 {
		t.Errorf("one = %s", rowsText(one))
	}
}

func TestAHiddenBoardItemIsAbsentFromTheTally(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	cm.UseAreaDirectory(fakeDirectory{areas: threeAreas(), placed: map[string]string{"amina": "North"}})
	shown := putOnBoard(t, cm, "Streetlights out")
	hidden := putOnBoard(t, cm, "Rubbish at the market")
	saidMeToo(t, cm, hidden.ID, "amina")
	if err := cm.SetBoardItemHidden(ctx, hidden.ID, true); err != nil {
		t.Fatal(err)
	}
	got, err := cm.TallyBoardItemsByArea(ctx, "")
	if err != nil || len(got) != 1 || got[0].ID != shown.ID {
		t.Fatalf("tally = %+v (%v), want only the shown board item", got, err)
	}
}

func TestADirectoryErrorRefusesTheTallyInsteadOfGuessingAnArea(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	boom := errors.New("directory down")
	cm.UseAreaDirectory(fakeDirectory{err: boom})
	b := putOnBoard(t, cm, "Streetlights out")
	saidMeToo(t, cm, b.ID, "amina")
	if _, err := cm.TallyBoardItemsByArea(ctx, ""); !errors.Is(err, boom) {
		t.Fatalf("err = %v, want the directory's error", err)
	}
}
