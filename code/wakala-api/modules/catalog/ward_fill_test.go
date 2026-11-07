package mwanachamacatalog_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/geo"
	"wakalaserver/modules/shared/spec"
)

func wardManager(t *testing.T) catalog.CatalogManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := catalog.SpecFor("wardtest", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := spec.Migrate(db, s); err != nil {
		t.Fatal(err)
	}
	cm, err := catalog.NewCatalogManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	cm.UseAreaResolver(func(_ context.Context, pin *geo.Position, _ string) (string, error) {
		if pin != nil && pin.Lon() >= 0 && pin.Lon() <= 10 && pin.Lat() >= 0 && pin.Lat() <= 10 {
			return "Belső kerület", nil
		}
		return "", nil
	})
	return cm
}

func pinAt(lon, lat float64) *geo.Geometry {
	g := geo.NewPoint(lon, lat)
	return &g
}

func TestRaisedItemWithAPinAndNoWardGetsTheBoundaryWard(t *testing.T) {
	cm := wardManager(t)
	got, err := cm.RaiseItem(context.Background(), catalog.RaisedItem{Title: "Törött lámpa", RaisedBy: "r1", Pin: pinAt(5, 5)})
	if err != nil {
		t.Fatal(err)
	}
	if got.Area != "Belső kerület" || got.AreaMismatch != "" {
		t.Fatalf("area %q mismatch %q, want the derived ward and no flag", got.Area, got.AreaMismatch)
	}
}

func TestRaisedItemKeepsATypedWardAndFlagsADisagreement(t *testing.T) {
	cm := wardManager(t)
	ctx := context.Background()
	got, err := cm.RaiseItem(ctx, catalog.RaisedItem{Title: "Törött lámpa", RaisedBy: "r1", Pin: pinAt(5, 5), Area: "Külső kerület"})
	if err != nil {
		t.Fatal(err)
	}
	if got.Area != "Külső kerület" || got.AreaMismatch != "Belső kerület" {
		t.Fatalf("area %q mismatch %q, want the typed ward kept and the derived one flagged", got.Area, got.AreaMismatch)
	}
	stored, err := cm.ListRaisedItems(ctx, "r1")
	if err != nil || len(stored) != 1 || stored[0].Area != "Külső kerület" || stored[0].AreaMismatch != "Belső kerület" {
		t.Fatalf("stored %+v, %v", stored, err)
	}
	same, err := cm.RaiseItem(ctx, catalog.RaisedItem{Title: "Árok", RaisedBy: "r1", Pin: pinAt(5, 5), Area: "belső kerület"})
	if err != nil || same.AreaMismatch != "" {
		t.Fatalf("a typed ward that agrees was flagged: %+v, %v", same, err)
	}
}

func TestRaisedItemOutsideEveryBoundaryKeepsWhatWasTyped(t *testing.T) {
	cm := wardManager(t)
	got, err := cm.RaiseItem(context.Background(), catalog.RaisedItem{Title: "Árok", RaisedBy: "r1", Pin: pinAt(50, 50), Area: "Külső kerület"})
	if err != nil || got.Area != "Külső kerület" || got.AreaMismatch != "" {
		t.Fatalf("%+v, %v", got, err)
	}
}

func docOf(t *testing.T, e catalog.Entry) map[string]any {
	t.Helper()
	var doc map[string]any
	if err := json.Unmarshal([]byte(e.Doc), &doc); err != nil {
		t.Fatal(err)
	}
	return doc
}

func TestEntryWithALocationAndNoWardGetsTheBoundaryWard(t *testing.T) {
	cm := wardManager(t)
	e, err := cm.CreateEntry(context.Background(), catalog.Entry{Slug: "pad", Name: "Pad", Doc: `{"location":{"type":"Point","coordinates":[5,5]}}`})
	if err != nil {
		t.Fatal(err)
	}
	doc := docOf(t, e)
	if doc["ward"] != "Belső kerület" || doc["ward_mismatch"] != nil {
		t.Fatalf("doc %v", doc)
	}
}

func TestEntryKeepsATypedWardAndFlagsADisagreement(t *testing.T) {
	cm := wardManager(t)
	e, err := cm.CreateEntry(context.Background(), catalog.Entry{Slug: "pad", Name: "Pad", Doc: `{"location":{"type":"Point","coordinates":[5,5]},"ward":"Külső kerület"}`})
	if err != nil {
		t.Fatal(err)
	}
	doc := docOf(t, e)
	if doc["ward"] != "Külső kerület" || doc["ward_mismatch"] != "Belső kerület" {
		t.Fatalf("doc %v", doc)
	}
}

func TestEntryResubmittedWithoutTheDerivedWardIsNotChangedContent(t *testing.T) {
	cm := wardManager(t)
	ctx := context.Background()
	sent := catalog.Entry{Slug: "pad", Name: "Pad", Doc: `{"location":{"type":"Point","coordinates":[5,5]}}`}
	if _, err := cm.CreateEntry(ctx, sent); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.SetVisibility(ctx, "pad", catalog.VisibilityPublic); err != nil {
		t.Fatal(err)
	}
	again, err := cm.UpdateEntry(ctx, sent)
	if err != nil {
		t.Fatal(err)
	}
	if again.Visibility != catalog.VisibilityPublic || !strings.Contains(again.Doc, "Belső kerület") {
		t.Fatalf("visibility %q doc %s", again.Visibility, again.Doc)
	}
}

func TestEntryWithoutALocationIsLeftAlone(t *testing.T) {
	cm := wardManager(t)
	e, err := cm.CreateEntry(context.Background(), catalog.Entry{Slug: "pad", Name: "Pad", Doc: `{"note":"x"}`})
	if err != nil || e.Doc != `{"note":"x"}` {
		t.Fatalf("%+v, %v", e, err)
	}
}
