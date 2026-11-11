package mwanachamacatalog_test

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"sync"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

func localPostgresSchemaOrSkip(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL is not set")
	}
	u, err := url.Parse(dsn)
	if err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost") {
		t.Skip("DATABASE_URL does not point at 127.0.0.1 or localhost")
	}
	admin, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open postgres: %v", err)
	}
	schema := fmt.Sprintf("holder_race_%d", time.Now().UnixNano())
	if err := admin.Exec("create schema " + schema).Error; err != nil {
		t.Fatalf("create schema: %v", err)
	}
	query := u.Query()
	query.Set("search_path", schema)
	u.RawQuery = query.Encode()
	db, err := gorm.Open(postgres.Open(u.String()), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open postgres in %s: %v", schema, err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
		admin.Exec("drop schema " + schema + " cascade")
		if sqlDB, err := admin.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return db
}

func TestOnePerHolderHoldsWhenTheSameHolderIsWrittenInManyScopesAtOnceOnPostgres(t *testing.T) {
	db := localPostgresSchemaOrSkip(t)
	s, err := catalog.SpecFor("ledgers", "")
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
	if _, err := cm.PutSetting(ctx, catalog.SettingOneRecordPerHolder, "true"); err != nil {
		t.Fatal(err)
	}
	const rounds, scopes = 10, 8
	for round := 0; round < rounds; round++ {
		subject := fmt.Sprintf("clinic-%d", round)
		start := make(chan struct{})
		errs := make([]error, scopes)
		var wg sync.WaitGroup
		for i := 0; i < scopes; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				<-start
				_, errs[i] = cm.PutRecord(ctx, catalog.Record{SubjectID: subject, HolderID: "resident-1", ScopeID: fmt.Sprintf("ward-%d", i), Doc: `{"bags":4}`})
			}()
		}
		close(start)
		wg.Wait()
		wins := 0
		for _, err := range errs {
			switch {
			case err == nil:
				wins++
			case !errors.Is(err, catalog.ErrRecordHolderSpoke):
				t.Fatalf("round %d: a refused write answered %v, want ErrRecordHolderSpoke", round, err)
			}
		}
		kept, err := cm.ListRecords(ctx, subject, "")
		if err != nil {
			t.Fatal(err)
		}
		if wins != 1 || len(kept) != 1 {
			t.Fatalf("round %d: %d writes succeeded and the holder has %d records, want 1 and 1", round, wins, len(kept))
		}
	}
}
