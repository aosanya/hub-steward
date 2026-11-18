package http

import (
	"context"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

func TestTheOwnerReadsAnAnonymousItemOfAPersonAndAStaffReaderDoesNot(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := catalog.SpecFor("anonymouswish", "")
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
	ctx := context.Background()
	if _, err := cm.RaiseItem(ctx, catalog.RaisedItem{Title: "Árok", RaisedBy: "r1", Anonymous: true}); err != nil {
		t.Fatal(err)
	}
	staff, err := cm.ListRaisedItemsOfPerson(ctx, "r1")
	if err != nil || len(staff) != 0 {
		t.Fatalf("staff read %d items, %v, want none", len(staff), err)
	}
	owner, err := agencyOwnedCatalog{CatalogManager: cm}.ListRaisedItemsOfPerson(ctx, "r1")
	if err != nil || len(owner) != 1 {
		t.Fatalf("the owner read %d items, %v, want 1", len(owner), err)
	}
}
