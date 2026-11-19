package agencies

import (
	"context"
	"reflect"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	mwanachamacatalog "github.com/aosanya/mwanachama-backend-catalog"
)

type areaFixture struct {
	directory mwanachamacatalog.AreaDirectory
	amina     string
	baraka    string
	chiku     string
}

func newAreaFixture(t *testing.T) areaFixture {
	t.Helper()
	ctx := context.Background()
	reg, err := NewRegistry(sharedMemoryDB(t))
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	inst, err := reg.CreateInstance(ctx, "Town")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	actors, err := reg.ActorManager(ctx, inst.ID)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	hierarchy, err := actors.CreateHierarchy(ctx, mwanachamaactor.Hierarchy{Name: "Council"})
	if err != nil {
		t.Fatalf("CreateHierarchy: %v", err)
	}
	wardLevel, err := actors.CreateLevel(ctx, mwanachamaactor.Level{HierarchyID: hierarchy.ID, Name: "Ward", IsArea: true})
	if err != nil {
		t.Fatalf("CreateLevel ward: %v", err)
	}
	clubLevel, err := actors.CreateLevel(ctx, mwanachamaactor.Level{HierarchyID: hierarchy.ID, Name: "Club", Depth: 1})
	if err != nil {
		t.Fatalf("CreateLevel club: %v", err)
	}
	group := func(name, levelID string) mwanachamaactor.Group {
		g, err := actors.CreateGroup(ctx, mwanachamaactor.Group{Name: name, HierarchyID: hierarchy.ID, LevelID: levelID})
		if err != nil {
			t.Fatalf("CreateGroup %s: %v", name, err)
		}
		return g
	}
	north, east, chess := group("North", wardLevel.ID), group("East", wardLevel.ID), group("Chess club", clubLevel.ID)
	for _, p := range []struct {
		group      string
		population int
		asOf       string
	}{{north.ID, 4000, "2025-01-01"}, {north.ID, 4100, "2026-01-01"}, {east.ID, 3800, "2026-01-01"}} {
		if _, err := actors.RecordGroupPopulation(ctx, p.group, p.population, p.asOf, "census", ""); err != nil {
			t.Fatalf("RecordGroupPopulation: %v", err)
		}
	}
	member := func(name string, groupIDs ...string) string {
		a, err := actors.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
		if err != nil {
			t.Fatalf("CreateActor %s: %v", name, err)
		}
		for _, g := range groupIDs {
			if _, err := actors.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: a.ID, GroupID: g}); err != nil {
				t.Fatalf("AssignGroup %s: %v", name, err)
			}
		}
		return a.ID
	}
	return areaFixture{
		directory: newAreaDirectory(actors),
		amina:     member("Amina", north.ID, chess.ID),
		baraka:    member("Baraka", east.ID),
		chiku:     member("Chiku", chess.ID),
	}
}

func TestAreaDirectory_AreasOfNamesTheAreaGroupEachPersonBelongsTo(t *testing.T) {
	f := newAreaFixture(t)
	got, err := f.directory.AreasOf(context.Background(), []string{f.amina, f.baraka, f.chiku, "stranger"})
	if err != nil {
		t.Fatalf("AreasOf: %v", err)
	}
	want := map[string]string{f.amina: "North", f.baraka: "East"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("AreasOf = %v, want %v (a member of no area, and a stranger, are absent)", got, want)
	}
}

func TestAreaDirectory_AreasOfAnswersOnlyForThePeopleAsked(t *testing.T) {
	f := newAreaFixture(t)
	got, err := f.directory.AreasOf(context.Background(), []string{f.baraka})
	if err != nil {
		t.Fatalf("AreasOf: %v", err)
	}
	if want := map[string]string{f.baraka: "East"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("AreasOf = %v, want %v", got, want)
	}
	none, err := f.directory.AreasOf(context.Background(), nil)
	if err != nil || len(none) != 0 {
		t.Fatalf("AreasOf(nil) = %v, %v, want empty", none, err)
	}
}

func TestAreaDirectory_AreasListsEveryAreaGroupWithItsLatestPopulation(t *testing.T) {
	f := newAreaFixture(t)
	got, err := f.directory.Areas(context.Background())
	if err != nil {
		t.Fatalf("Areas: %v", err)
	}
	want := []mwanachamacatalog.AreaPopulation{{Area: "North", Population: 4100}, {Area: "East", Population: 3800}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Areas = %v, want %v (the club is not an area; North answers its latest figure)", got, want)
	}
}

func TestAreaDirectory_NoAreaLevelMeansNoAreas(t *testing.T) {
	ctx := context.Background()
	reg, err := NewRegistry(sharedMemoryDB(t))
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	inst, _ := reg.CreateInstance(ctx, "Town")
	actors, err := reg.ActorManager(ctx, inst.ID)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	directory := newAreaDirectory(actors)
	if areas, err := directory.Areas(ctx); err != nil || len(areas) != 0 {
		t.Fatalf("Areas = %v, %v, want none", areas, err)
	}
	if placed, err := directory.AreasOf(ctx, []string{"someone"}); err != nil || len(placed) != 0 {
		t.Fatalf("AreasOf = %v, %v, want none", placed, err)
	}
}
