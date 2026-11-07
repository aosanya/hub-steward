package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	insights "wakalaserver/modules/insights"
)

func TestGetInsightsCountsOverHTTPWithholdsSmallSubjects(t *testing.T) {
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
	instance := fmt.Sprintf("mun11h%d", os.Getpid())
	s, err := insights.SpecFor(instance)
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
	if err := insights.Provision(db, s); err != nil {
		t.Fatal(err)
	}
	im, err := insights.NewInsightManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	for subject, n := range map[string]int{"ward-a": 9, "ward-b": 2, "ward-c": 1, "ward-d": 7} {
		for i := 0; i < n; i++ {
			if _, err := im.CreateInsight(ctx, insights.Insight{SubjectID: subject, Summary: "s", Repo: "r"}); err != nil {
				t.Fatal(err)
			}
		}
	}
	mux := http.NewServeMux()
	for _, rt := range Routes(im) {
		mux.HandleFunc(rt.Pattern(""), rt.Handler)
	}
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/insights/counts", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var got insights.SubjectCounts
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Minimum != insights.DefaultMinimumCount || !got.TotalPublished || got.Total != 19 {
		t.Fatalf("%+v", got)
	}
	byID := map[string]insights.SubjectCount{}
	for _, it := range got.Items {
		byID[it.SubjectID] = it
	}
	if _, ok := byID["ward-b"]; ok {
		t.Fatalf("small subject listed on its own: %+v", got.Items)
	}
	if _, ok := byID["ward-c"]; ok {
		t.Fatalf("small subject listed on its own: %+v", got.Items)
	}
	other, ok := byID["other"]
	if !ok || other.Count != 0 {
		t.Fatalf("other cell missing or leaking: %+v", got.Items)
	}
	if d := byID["ward-d"]; !d.Suppressed || d.Count != 0 {
		t.Fatalf("cover cell leaks: %+v", d)
	}
	if a := byID["ward-a"]; a.Suppressed || a.Count != 9 {
		t.Fatalf("%+v", a)
	}
	if strings.Contains(rec.Body.String(), "ward-b") || strings.Contains(rec.Body.String(), "ward-c") {
		t.Fatalf("body names a small subject: %s", rec.Body.String())
	}
}
