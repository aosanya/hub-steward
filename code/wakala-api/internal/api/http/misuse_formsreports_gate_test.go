package http

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	catalog "wakalaserver/modules/catalog"
	forms "wakalaserver/modules/forms"
	"wakalaserver/modules/shared/spec"

	"wakalaserver/internal/agencies"
)

func gateTestDB(t *testing.T, name string) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:wakala_gate_%s_%d?mode=memory&cache=shared", name, stepRunDatabases.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return db
}

func TestReportsAndForms_PersonWithoutPermissionCannotDoPublishOrReadPrivate(t *testing.T) {
	rdb := gateTestDB(t, "reports")
	rs, err := catalog.SpecFor("gatetest", "")
	if err != nil {
		t.Fatalf("catalog SpecFor: %v", err)
	}
	if err := spec.Migrate(rdb, rs); err != nil {
		t.Fatalf("catalog Migrate: %v", err)
	}
	cm, err := catalog.NewCatalogManager(rdb, rs)
	if err != nil {
		t.Fatalf("NewCatalogManager: %v", err)
	}
	fdb := gateTestDB(t, "forms")
	fs, err := forms.SpecFor("gatetest")
	if err != nil {
		t.Fatalf("forms SpecFor: %v", err)
	}
	if err := forms.Provision(fdb, fs); err != nil {
		t.Fatalf("forms Provision: %v", err)
	}
	fm, err := forms.NewFormManager(fdb, fs)
	if err != nil {
		t.Fatalf("NewFormManager: %v", err)
	}
	w := newStepRunWalk(t, nil)
	w.deps.Reports = cm
	w.deps.Forms = fm
	w.handler = NewRouter(w.deps)
	resident := w.cookieFor(t, "resident-anna")
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "resident-anna", agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}

	slug := "street-lights-ward-3"
	put := w.call(t, "PUT", "/reports/entries/"+slug, map[string]any{"slug": slug, "name": "Street lights", "summary": "Ward 3 lights", "doc": "{}", "visibility": "pending"}, resident)
	if put.Code != http.StatusForbidden {
		t.Errorf("ordinary resident writes report entry: got %d %s, want 403", put.Code, put.Body.String())
	}
	vis := w.call(t, "POST", "/reports/entries/"+slug+"/visibility", map[string]any{"visibility": "public"}, resident)
	if vis.Code != http.StatusForbidden {
		t.Errorf("ordinary resident publishes report entry: got %d %s, want 403", vis.Code, vis.Body.String())
	}
	admin := w.call(t, "GET", "/reports/entries/"+slug+"/admin", nil, resident)
	if admin.Code != http.StatusForbidden {
		t.Errorf("ordinary resident reads report admin view: got %d %s, want 403", admin.Code, admin.Body.String())
	}
	form := w.call(t, "POST", "/forms/forms", map[string]any{"title": "Ward survey", "closes_at": "2027-01-01T00:00:00Z"}, resident)
	if form.Code != http.StatusForbidden {
		t.Errorf("ordinary resident creates a form: got %d %s, want 403", form.Code, form.Body.String())
	}
}
