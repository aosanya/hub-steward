package mwanachamainsights

import (
	"fmt"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wakalaserver/modules/shared/spec"
)

func sqliteManager(t *testing.T) (InsightManager, *gorm.DB, *spec.Spec) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := SpecFor("cover")
	if err != nil {
		t.Fatal(err)
	}
	if err := Provision(db, s); err != nil {
		t.Fatal(err)
	}
	im, err := NewInsightManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return im, db, s
}

func tickingClock(im InsightManager) {
	n := 0
	im.(*insightManager).now = func() string {
		n++
		return fmt.Sprintf("2026-11-10T10:00:%02dZ", n)
	}
}
