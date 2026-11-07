package custody_test

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"

	custody "wakalaserver/modules/custody"
)

const testSpec = "spec/examples/mwanachama.custody.json"

func newTestDB(t *testing.T) (*gorm.DB, *spec.Spec) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	s, err := custody.LoadSpec(testSpec)
	if err != nil {
		t.Fatalf("LoadSpec: %v", err)
	}
	if err := custody.Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	return db, s
}

func monotonicClock(start time.Time) custody.Clock {
	t := start
	return func() time.Time {
		t = t.Add(time.Second)
		return t
	}
}
