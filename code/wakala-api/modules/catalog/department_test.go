package mwanachamacatalog_test

import (
	"context"
	"errors"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

func routedManager(t *testing.T, routing any) catalog.CatalogManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := catalog.SpecFor("routetest", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := spec.Migrate(db, s); err != nil {
		t.Fatal(err)
	}
	if routing != nil {
		if _, err := spec.StoreOverride(db, s, "routing", routing, "tester", "2026-01-01T00:00:00Z"); err != nil {
			t.Fatal(err)
		}
	}
	cm, err := catalog.NewCatalogManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return cm
}

var routing = map[string]any{
	"default": "Front desk",
	"rules": []any{
		map[string]any{"topic": "Roads", "department": "Public works"},
		map[string]any{"topic": "Waste", "department": "Sanitation"},
	},
}

func TestRaisedItemIsRoutedToADepartmentByItsTopic(t *testing.T) {
	cm := routedManager(t, routing)
	ctx := context.Background()
	roads, err := cm.RaiseItem(ctx, catalog.RaisedItem{Title: "Gödör", Topic: "roads", RaisedBy: "r1"})
	if err != nil || roads.Department != "Public works" || roads.DepartmentBy != catalog.DepartmentByRule {
		t.Fatalf("roads %+v, %v", roads, err)
	}
	other, err := cm.RaiseItem(ctx, catalog.RaisedItem{Title: "Zaj", Topic: "Noise", RaisedBy: "r1"})
	if err != nil || other.Department != "Front desk" || other.DepartmentBy != catalog.DepartmentByRule {
		t.Fatalf("other %+v, %v", other, err)
	}
	mine, err := cm.ListRaisedItems(ctx, "r1")
	if err != nil || len(mine) != 2 {
		t.Fatalf("mine %+v, %v", mine, err)
	}
	for _, m := range mine {
		if m.Department == "" || m.Status != catalog.StatusReceived {
			t.Fatalf("resident read %+v, want the department and a status", m)
		}
	}
}

func TestRaisedItemWithoutARoutingSettingHasNoDepartment(t *testing.T) {
	cm := routedManager(t, nil)
	got, err := cm.RaiseItem(context.Background(), catalog.RaisedItem{Title: "Gödör", Topic: "Roads", RaisedBy: "r1"})
	if err != nil || got.Department != "" || got.DepartmentBy != "" {
		t.Fatalf("got %+v, %v", got, err)
	}
}

func TestRaiserCannotChooseTheDepartmentButAnOfficerFilingCan(t *testing.T) {
	cm := routedManager(t, routing)
	ctx := context.Background()
	own, err := cm.RaiseItem(ctx, catalog.RaisedItem{Title: "Gödör", Topic: "Roads", RaisedBy: "r1", Department: "Sanitation", DepartmentBy: "officer"})
	if err != nil || own.Department != "Public works" || own.DepartmentBy != catalog.DepartmentByRule {
		t.Fatalf("raiser's choice was kept: %+v, %v", own, err)
	}
	filed, err := cm.FileRaisedItem(ctx, catalog.RaisedItem{Title: "Gödör", Topic: "Roads", RaisedBy: "r1", FiledBy: "o1", Channel: "phone", Department: "Sanitation"})
	if err != nil || filed.Department != "Sanitation" || filed.DepartmentBy != catalog.DepartmentByOfficer {
		t.Fatalf("officer's choice was overridden: %+v, %v", filed, err)
	}
}

func TestOfficerReassignmentIsKeptAndShownToTheResident(t *testing.T) {
	cm := routedManager(t, routing)
	ctx := context.Background()
	item, err := cm.RaiseItem(ctx, catalog.RaisedItem{Title: "Gödör", Topic: "Roads", RaisedBy: "r1"})
	if err != nil {
		t.Fatal(err)
	}
	if err := cm.ReassignRaisedItem(ctx, item.ID, " Sanitation "); err != nil {
		t.Fatal(err)
	}
	mine, err := cm.ListRaisedItems(ctx, "r1")
	if err != nil || len(mine) != 1 || mine[0].Department != "Sanitation" || mine[0].DepartmentBy != catalog.DepartmentByOfficer {
		t.Fatalf("mine %+v, %v", mine, err)
	}
	if err := cm.ReassignRaisedItem(ctx, item.ID, " "); !errors.Is(err, catalog.ErrInvalidRaisedItem) {
		t.Fatalf("empty department: %v", err)
	}
	if err := cm.ReassignRaisedItem(ctx, "nope", "Sanitation"); !errors.Is(err, catalog.ErrRaisedItemNotFound) {
		t.Fatalf("unknown item: %v", err)
	}
}

func TestFollowedItemShowsDepartmentAndStatus(t *testing.T) {
	cm := routedManager(t, routing)
	ctx := context.Background()
	item, err := cm.RaiseItem(ctx, catalog.RaisedItem{Title: "Szemét", Topic: "Waste", RaisedBy: "r1"})
	if err != nil {
		t.Fatal(err)
	}
	key, err := cm.IssueFollowKey(ctx, item.ID)
	if err != nil {
		t.Fatal(err)
	}
	followed, err := cm.OpenFollowedRaisedItem(ctx, key.Key)
	if err != nil || followed.Item.Department != "Sanitation" || followed.Status != catalog.StatusReceived {
		t.Fatalf("followed %+v, %v", followed, err)
	}
}

func TestRoutingSettingMustBeWellFormed(t *testing.T) {
	bad := `{"routing":{"default":"A","rules":[{"topic":"Roads","department":"B"},{"topic":"roads","department":"C"}]}}`
	if len(catalog.CheckSettings([]byte(bad))) == 0 {
		t.Fatal("a topic named twice was accepted")
	}
	good := `{"routing":{"default":"A","rules":[{"topic":"Roads","department":"B"}]}}`
	if problems := catalog.CheckSettings([]byte(good)); len(problems) != 0 {
		t.Fatalf("problems %v", problems)
	}
}
