package mwanachamainsights

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
)

func TestCountInsightsBySubjectWithholdsSmallSubjectsInTheDatabase(t *testing.T) {
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
	instance := fmt.Sprintf("mun11i%d", os.Getpid())
	s, err := SpecFor(instance)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		var names []string
		db.Raw("select tablename from pg_tables where schemaname = current_schema() and tablename like ?", instance+"%").Scan(&names)
		for _, name := range names {
			db.Exec(fmt.Sprintf("drop table if exists %q cascade", strings.ReplaceAll(name, `"`, "")))
		}
	})
	if err := Provision(db, s); err != nil {
		t.Fatal(err)
	}
	im, err := NewInsightManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	for subject, n := range map[string]int{"ward-a": 9, "ward-b": 2, "ward-c": 6} {
		for i := 0; i < n; i++ {
			if _, err := im.CreateInsight(ctx, Insight{SubjectID: subject, Summary: "s", Repo: "r"}); err != nil {
				t.Fatalf("CreateInsight: %v", err)
			}
		}
	}
	got, err := im.CountInsightsBySubject(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if got.Minimum != DefaultMinimumCount {
		t.Fatalf("%+v", got)
	}
	hidden := 0
	for _, c := range got.Items {
		if c.Suppressed {
			hidden++
			if c.Count != 0 {
				t.Fatalf("%s leaks %d", c.SubjectID, c.Count)
			}
		}
	}
	if hidden < 2 {
		t.Fatalf("a lone suppressed cell is recoverable, hidden = %d", hidden)
	}
}
