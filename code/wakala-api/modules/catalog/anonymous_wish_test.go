package mwanachamacatalog_test

import (
	"context"
	"testing"

	catalog "wakalaserver/modules/catalog"
)

func TestAnAnonymousItemIsListedForItsRaiserAndTheOwnerOnly(t *testing.T) {
	cm := wardManager(t)
	ctx := context.Background()
	if _, err := cm.RaiseItem(ctx, catalog.RaisedItem{Title: "Árok a Kossuth utcán", RaisedBy: "r1", Anonymous: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.RaiseItem(ctx, catalog.RaisedItem{Title: "Törött lámpa", RaisedBy: "r1"}); err != nil {
		t.Fatal(err)
	}
	own, err := cm.ListRaisedItems(ctx, "r1")
	if err != nil || len(own) != 2 {
		t.Fatalf("the raiser reads %d of their own items, %v, want 2", len(own), err)
	}
	staff, err := cm.ListRaisedItemsOfPerson(ctx, "r1")
	if err != nil || len(staff) != 1 || staff[0].Title != "Törött lámpa" {
		t.Fatalf("staff read %+v, %v, want only the named item", staff, err)
	}
	owner, err := cm.ListRaisedItemsOfPerson(catalog.AsAgencyOwner(ctx), "r1")
	if err != nil || len(owner) != 2 {
		t.Fatalf("the owner reads %d items, %v, want both", len(owner), err)
	}
}

func TestAnAnonymousItemGivesOthersNoRaiserName(t *testing.T) {
	anonymous := catalog.RaisedItem{Title: "Árok", RaisedBy: "r1", Anonymous: true}
	if seen := anonymous.AsSeenByOthers(); seen.RaisedBy != "" {
		t.Fatalf("others see raised_by %q, want none", seen.RaisedBy)
	}
	named := catalog.RaisedItem{Title: "Lámpa", RaisedBy: "r1"}
	if seen := named.AsSeenByOthers(); seen.RaisedBy != "r1" {
		t.Fatalf("others see raised_by %q, want the name kept", seen.RaisedBy)
	}
}
