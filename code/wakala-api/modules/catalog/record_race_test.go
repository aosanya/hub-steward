package mwanachamacatalog_test

import (
	"context"
	"testing"

	"gorm.io/gorm"

	catalog "wakalaserver/modules/catalog"
)

func TestALosingRaceOnARecordReplacesTheWinnerNotAStoreError(t *testing.T) {
	cm, db, s := overriddenManagerOn(t, nil)
	ctx := context.Background()
	if _, err := cm.PutRecord(ctx, catalog.Record{SubjectID: "clinic", HolderID: "resident-1", ScopeID: "ward-3", Doc: `{"bags":4}`}); err != nil {
		t.Fatal(err)
	}
	object, ok := s.ByRole("record")
	if !ok {
		t.Fatal("no record object")
	}
	table := s.TableFor(object)
	armed := true
	err := db.Callback().Query().After("gorm:query").Register("stale", func(tx *gorm.DB) {
		if rows, ok := tx.Statement.Dest.(*[]map[string]any); ok && armed && tx.Statement.Table == table {
			*rows = nil
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	err = db.Callback().Create().After("gorm:create").Register("disarm", func(tx *gorm.DB) {
		if tx.Statement.Table == table {
			armed = false
		}
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := cm.PutRecord(ctx, catalog.Record{SubjectID: "clinic", HolderID: "resident-1", ScopeID: "ward-3", Doc: `{"bags":6}`}); err != nil {
		t.Fatalf("a write that lost the race to the same holder's write = %v, want it to replace the winner", err)
	}
	kept, err := cm.ListRecords(ctx, "clinic", "ward-3")
	if err != nil || len(kept) != 1 || kept[0].Doc != `{"bags":6}` {
		t.Fatalf("kept %+v %v, want the later document alone", kept, err)
	}
}
