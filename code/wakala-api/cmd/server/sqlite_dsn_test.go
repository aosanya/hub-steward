package main

import (
	"context"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestDefaultDatabaseIsOneDatabaseForEveryConnection(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(sqliteDSN("")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Exec("CREATE TABLE agency_instances (id TEXT)").Error; err != nil {
		t.Fatal(err)
	}
	pool, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	pool.SetMaxOpenConns(4)
	ctx := context.Background()
	first, err := pool.Conn(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer first.Close()
	second, err := pool.Conn(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()
	rows, err := second.QueryContext(ctx, "SELECT * FROM agency_instances")
	if err != nil {
		t.Fatalf("second connection cannot see the table: %v", err)
	}
	rows.Close()
}

func TestDefaultDatabasesAreSeparate(t *testing.T) {
	if sqliteDSN("") == sqliteDSN("") {
		t.Fatal("two default databases share one name")
	}
}

func TestSqlitePathIsKept(t *testing.T) {
	if got := sqliteDSN("/tmp/x.db"); got != "/tmp/x.db" {
		t.Fatalf("got %q", got)
	}
}
