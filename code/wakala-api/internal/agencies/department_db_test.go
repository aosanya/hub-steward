package agencies

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	mwanachamacatalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

func TestCatalogRoutesAndReassignsReportsInTheDatabase(t *testing.T) {
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
	instance := fmt.Sprintf("mun15d%d", os.Getpid())
	t.Cleanup(func() {
		var names []string
		db.Raw("select tablename from pg_tables where schemaname = current_schema() and tablename like ?", instance+"%").Scan(&names)
		for _, name := range names {
			db.Exec(fmt.Sprintf("drop table if exists %q cascade", strings.ReplaceAll(name, `"`, "")))
		}
	})
	cs, err := mwanachamacatalog.SpecFor(instance, "reports")
	if err != nil {
		t.Fatal(err)
	}
	if err := spec.Migrate(db, cs); err != nil {
		t.Fatal(err)
	}
	routing := map[string]any{
		"default": "Front desk",
		"rules":   []any{map[string]any{"topic": "Roads", "department": "Public works"}},
	}
	if _, err := spec.StoreOverride(db, cs, "routing", routing, "tester", "2026-01-01T00:00:00Z"); err != nil {
		t.Fatal(err)
	}
	cm, err := mwanachamacatalog.NewCatalogManager(db, cs)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	roads, err := cm.RaiseItem(ctx, mwanachamacatalog.RaisedItem{Title: "Gödör", Topic: "Roads", RaisedBy: "r1", Publishable: true})
	if err != nil || roads.Department != "Public works" {
		t.Fatalf("roads %+v, %v", roads, err)
	}
	other, err := cm.RaiseItem(ctx, mwanachamacatalog.RaisedItem{Title: "Zaj", Topic: "Noise", RaisedBy: "r1"})
	if err != nil || other.Department != "Front desk" {
		t.Fatalf("other %+v, %v", other, err)
	}
	if err := cm.ReassignRaisedItem(ctx, other.ID, "Sanitation"); err != nil {
		t.Fatal(err)
	}
	board, err := cm.PutOnBoard(ctx, mwanachamacatalog.BoardItem{Title: "Utcai gödrök"})
	if err != nil {
		t.Fatal(err)
	}
	if err := cm.GroupUnderBoardItem(ctx, roads.ID, board.ID); err != nil {
		t.Fatal(err)
	}
	if err := cm.CloseBoardItem(ctx, board.ID, "o1"); err != nil {
		t.Fatal(err)
	}
	mine, err := cm.ListRaisedItems(ctx, "r1")
	if err != nil || len(mine) != 2 {
		t.Fatalf("mine %+v, %v", mine, err)
	}
	seen := map[string]mwanachamacatalog.MyRaisedItem{}
	for _, m := range mine {
		seen[m.ID] = m
	}
	if g := seen[other.ID]; g.Department != "Sanitation" || g.DepartmentBy != mwanachamacatalog.DepartmentByOfficer || g.Status != mwanachamacatalog.StatusReceived {
		t.Fatalf("reassigned %+v", g)
	}
	if g := seen[roads.ID]; g.Department != "Public works" || g.DepartmentBy != mwanachamacatalog.DepartmentByRule || g.Status != mwanachamacatalog.StatusClosed {
		t.Fatalf("routed %+v", g)
	}
}
