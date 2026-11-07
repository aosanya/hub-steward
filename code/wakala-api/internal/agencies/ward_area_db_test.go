package agencies

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamacatalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/geo"
	"wakalaserver/modules/shared/spec"
)

func square(minLon, minLat, maxLon, maxLat float64) *geo.Geometry {
	g := geo.NewPolygon(geo.Ring{{minLon, minLat}, {maxLon, minLat}, {maxLon, maxLat}, {minLon, maxLat}, {minLon, minLat}})
	return &g
}

func TestCatalogFillsTheWardFromGroupBoundariesInTheDatabase(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL is not set")
	}
	u, err := url.Parse(dsn)
	if err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost") {
		t.Skip("DATABASE_URL does not point at 127.0.0.1 or localhost")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	instance := fmt.Sprintf("mun12w%d", os.Getpid())
	t.Cleanup(func() {
		var names []string
		db.Raw("select tablename from pg_tables where schemaname = current_schema() and tablename like ?", instance+"%").Scan(&names)
		for _, name := range names {
			db.Exec(fmt.Sprintf("drop table if exists %q cascade", strings.ReplaceAll(name, `"`, "")))
		}
	})
	as, err := mwanachamaactor.SpecFor(instance)
	if err != nil {
		t.Fatal(err)
	}
	if err := mwanachamaactor.Provision(db, as); err != nil {
		t.Fatal(err)
	}
	um, err := mwanachamaactor.NewUserManager(db, as)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if _, err := um.CreateGroup(ctx, mwanachamaactor.Group{Name: "Város", Boundary: square(0, 0, 10, 10)}); err != nil {
		t.Fatal(err)
	}
	if _, err := um.CreateGroup(ctx, mwanachamaactor.Group{Name: "Belső kerület", Boundary: square(1, 1, 3, 3)}); err != nil {
		t.Fatal(err)
	}
	cs, err := mwanachamacatalog.SpecFor(instance, "reports")
	if err != nil {
		t.Fatal(err)
	}
	if err := spec.Migrate(db, cs); err != nil {
		t.Fatal(err)
	}
	cm, err := mwanachamacatalog.NewCatalogManager(db, cs)
	if err != nil {
		t.Fatal(err)
	}
	cm.UseAreaResolver(wardAreaResolver(um))

	pin := geo.NewPoint(2, 2)
	item, err := cm.RaiseItem(ctx, mwanachamacatalog.RaisedItem{Title: "Törött lámpa", RaisedBy: "r1", Pin: &pin})
	if err != nil {
		t.Fatal(err)
	}
	if item.Area != "Belső kerület" || item.AreaMismatch != "" {
		t.Fatalf("area %q mismatch %q, want the innermost ward", item.Area, item.AreaMismatch)
	}
	typed, err := cm.RaiseItem(ctx, mwanachamacatalog.RaisedItem{Title: "Árok", RaisedBy: "r1", Pin: &pin, Area: "Külső kerület"})
	if err != nil {
		t.Fatal(err)
	}
	if typed.Area != "Külső kerület" || typed.AreaMismatch != "Belső kerület" {
		t.Fatalf("area %q mismatch %q, want the typed ward kept and flagged", typed.Area, typed.AreaMismatch)
	}
	listed, err := cm.ListRaisedItems(ctx, "r1")
	if err != nil || len(listed) != 2 {
		t.Fatalf("listed %d, %v", len(listed), err)
	}
	e, err := cm.CreateEntry(ctx, mwanachamacatalog.Entry{Slug: "pad", Name: "Pad", Doc: `{"location":{"type":"Point","coordinates":[5,5]}}`})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(e.Doc, `"ward":"Város"`) {
		t.Fatalf("doc %s, want the town as the only boundary holding the point", e.Doc)
	}
	read, err := cm.GetEntry(ctx, "pad")
	var stored map[string]any
	if err != nil || json.Unmarshal([]byte(read.Doc), &stored) != nil || stored["ward"] != "Város" {
		t.Fatalf("stored doc %s, %v", read.Doc, err)
	}
}
