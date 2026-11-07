package mwanachamainsights

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wakalaserver/modules/shared/spec"
)

func TestCountInsightsBySubjectWithholdsSmallSubjectsInTheDatabase(t *testing.T) {
	im, _, _ := insightFixture(t)
	runWithholdsSmallSubjects(t, im)
}

func insightFixture(t *testing.T) (InsightManager, *gorm.DB, *spec.Spec) {
	t.Helper()
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
	im.UseSettings(func(ctx context.Context) (map[string]any, map[string]spec.Override, error) {
		return spec.LoadSettingLayers(db, s)
	})
	return im, db, s
}

func runWithholdsSmallSubjects(t *testing.T, im InsightManager) {
	t.Helper()
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

func TestDeclaredMinimumCountSettingChangesInsightCounts(t *testing.T) {
	im, db, s := insightFixture(t)
	ctx := context.Background()
	for subject, n := range map[string]int{"ward-a": 9, "ward-b": 4, "ward-c": 6} {
		for i := 0; i < n; i++ {
			if _, err := im.CreateInsight(ctx, Insight{SubjectID: subject, Summary: "s", Repo: "r"}); err != nil {
				t.Fatal(err)
			}
		}
	}
	before, err := im.CountInsightsBySubject(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if before.Minimum != DefaultMinimumCount || len(before.Items) != 3 || !before.Items[2].Suppressed {
		t.Fatalf("%+v", before)
	}
	if _, err := spec.StoreOverride(db, s, "minimum_count", 4, "clerk", time.Now().UTC().Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}
	got, err := im.CountInsightsBySubject(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if got.Minimum != 4 || !got.TotalPublished || got.Total != 19 {
		t.Fatalf("%+v", got)
	}
	for _, c := range got.Items {
		if c.Suppressed {
			t.Fatalf("%+v", got)
		}
	}
	if n, err := im.MinimumCount(ctx); err != nil || n != 4 {
		t.Fatalf("read back %d %v", n, err)
	}
}

func TestSetMinimumCountOnInsightManager(t *testing.T) {
	m := &insightManager{}
	if n, err := m.MinimumCount(context.Background()); err != nil || n != DefaultMinimumCount {
		t.Fatalf("%d %v", n, err)
	}
	if err := SetMinimumCount(m, 7); err != nil {
		t.Fatal(err)
	}
	if n, err := m.MinimumCount(context.Background()); err != nil || n != 7 {
		t.Fatalf("%d %v", n, err)
	}
	if err := SetMinimumCount(m, 1); err == nil {
		t.Fatal("accepted 1")
	}
}
