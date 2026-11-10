package accounts

import (
	"bytes"
	"database/sql"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func envOf(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestPoolFromEnvKeepsDefaultsWhenNothingIsSet(t *testing.T) {
	if got := PoolFromEnv("X", AccountPool, envOf(nil)); got != AccountPool {
		t.Errorf("got %+v", got)
	}
}

func TestPoolFromEnvTakesOpenIdleAndTimes(t *testing.T) {
	got := PoolFromEnv("X", ShopPool, envOf(map[string]string{
		"X_MAX_CONNS": " 9 ", "X_MAX_IDLE_CONNS": "3", "X_CONN_MAX_IDLE": "90s", "X_CONN_MAX_LIFETIME": "2h",
	}))
	want := PoolSettings{MaxOpen: 9, MaxIdle: 3, MaxIdleTime: 90 * time.Second, MaxLifetime: 2 * time.Hour}
	if got != want {
		t.Errorf("got %+v, want %+v", got, want)
	}
}

func TestIdleFollowsOpenOnlyWhenTheDefaultsHadThemEqual(t *testing.T) {
	equal := PoolFromEnv("X", PoolSettings{MaxOpen: 4, MaxIdle: 4}, envOf(map[string]string{"X_MAX_CONNS": "8"}))
	if equal.MaxOpen != 8 || equal.MaxIdle != 8 {
		t.Errorf("equal defaults: %+v", equal)
	}
	apart := PoolFromEnv("X", PoolSettings{MaxOpen: 10, MaxIdle: 2}, envOf(map[string]string{"X_MAX_CONNS": "20"}))
	if apart.MaxOpen != 20 || apart.MaxIdle != 2 {
		t.Errorf("apart defaults: %+v", apart)
	}
}

func TestIdleNeverExceedsOpen(t *testing.T) {
	got := PoolFromEnv("X", ShopPool, envOf(map[string]string{"X_MAX_CONNS": "2", "X_MAX_IDLE_CONNS": "50"}))
	if got.MaxOpen != 2 || got.MaxIdle != 2 {
		t.Errorf("got %+v", got)
	}
}

func TestPoolFromEnvIgnoresNonsenseAndAbsurdSizes(t *testing.T) {
	for _, bad := range []string{"", "abc", "0", "-3", "201", "1.5"} {
		got := PoolFromEnv("X", AccountPool, envOf(map[string]string{"X_MAX_CONNS": bad, "X_MAX_IDLE_CONNS": bad}))
		if got != AccountPool {
			t.Errorf("%q changed the pool to %+v", bad, got)
		}
	}
	for _, bad := range []string{"", "soon", "0s", "-5m"} {
		got := PoolFromEnv("X", AccountPool, envOf(map[string]string{"X_CONN_MAX_IDLE": bad, "X_CONN_MAX_LIFETIME": bad}))
		if got != AccountPool {
			t.Errorf("%q changed the times to %+v", bad, got)
		}
	}
}

func TestTenantLimitFromEnvFallsBackUnlessTheValueIsSane(t *testing.T) {
	cases := map[string]int{"": 7, "x": 7, "0": 7, "201": 7, "15": 15, " 200 ": 200}
	for raw, want := range cases {
		if got := TenantLimitFromEnv(7, envOf(map[string]string{"WAKALA_TENANT_DB_LIMIT": raw})); got != want {
			t.Errorf("%q: got %d, want %d", raw, got, want)
		}
	}
}

func TestApplyPutsTheSettingsOnTheDatabase(t *testing.T) {
	db, err := sql.Open("sqlite", "file:pool_apply?mode=memory&cache=shared")
	if err != nil {
		t.Skip("sqlite driver not registered under this name")
	}
	defer db.Close()
	PoolSettings{MaxOpen: 3, MaxIdle: 2, MaxIdleTime: time.Minute, MaxLifetime: time.Hour}.Apply(db)
	if got := db.Stats().MaxOpenConnections; got != 3 {
		t.Errorf("max open = %d", got)
	}
}

type captureWriter struct{ buf bytes.Buffer }

func (c *captureWriter) Printf(format string, args ...any) { fmt.Fprintf(&c.buf, format, args...) }

func TestGormLoggerStaysQuietAboutRecordNotFoundButReportsRealErrors(t *testing.T) {
	sink := &captureWriter{}
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: gormLoggerTo(sink)})
	if err != nil {
		t.Fatal(err)
	}
	type row struct{ ID int }
	if err := db.AutoMigrate(&row{}); err != nil {
		t.Fatal(err)
	}
	sink.buf.Reset()
	var r row
	if err := db.Take(&r).Error; !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("err = %v", err)
	}
	if sink.buf.Len() != 0 {
		t.Errorf("a missing row is the normal case and must not be logged: %q", sink.buf.String())
	}
	if err := db.Exec("select * from no_such_table").Error; err == nil {
		t.Fatal("expected an error")
	}
	if !bytes.Contains(sink.buf.Bytes(), []byte("no_such_table")) {
		t.Errorf("a real error must be logged: %q", sink.buf.String())
	}
}
