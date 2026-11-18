package models

import (
	"slices"
	"testing"
)

func TestPermissionCatalog_ServiceEditAndBoardManageCarryTheCatalogueWrites(t *testing.T) {
	for code, actions := range map[string][]string{
		"service.edit": {"catalog.entry.upsert", "catalog.entry.read"},
		"board.manage": {"catalog.board_item.assign"},
	} {
		p, ok := LookupPermission(code)
		if !ok {
			t.Fatalf("catalogue lacks %s", code)
		}
		for _, a := range actions {
			if !slices.Contains(p.Actions, a) {
				t.Errorf("%s lacks action %s, has %v", code, a, p.Actions)
			}
		}
	}
}

func TestPermissionCatalog_BoardReadReadsTheListAndTheCountByAreaAndNothingMore(t *testing.T) {
	read, ok := LookupPermission("board.read")
	if !ok {
		t.Fatal("catalogue lacks board.read")
	}
	if read.Module != "forms" {
		t.Errorf("board.read module = %q, want forms", read.Module)
	}
	for _, a := range []string{"catalog.board_item.list", "catalog.board_item.tally_by_area"} {
		if !slices.Contains(read.Actions, a) {
			t.Errorf("board.read lacks action %s, has %v", a, read.Actions)
		}
	}
	manage, _ := LookupPermission("board.manage")
	for _, a := range read.Actions {
		if slices.Contains(manage.Actions, a) {
			t.Errorf("board.manage also holds %s, so board.read adds nothing apart from it", a)
		}
	}
}

func TestPermissionCatalog_ResidentReadOpensTheListTheRecordAndTheBills(t *testing.T) {
	read, ok := LookupPermission("resident.read")
	if !ok {
		t.Fatal("catalogue lacks resident.read")
	}
	for _, a := range []string{"actor.actor.list", "actor.actor.read", "actor.actor.read_many", "accounting.bill.list", "accounting.bill.read", "accounting.payment.list"} {
		if !slices.Contains(read.Actions, a) {
			t.Errorf("resident.read lacks action %s, has %v", a, read.Actions)
		}
	}
	for _, a := range []string{"actor.actor.set_display_name", "actor.actor.set_attributes", "accounting.bill.create", "accounting.bill.update", "accounting.payment.mark_paid"} {
		if slices.Contains(read.Actions, a) {
			t.Errorf("resident.read holds the write action %s", a)
		}
	}
}
