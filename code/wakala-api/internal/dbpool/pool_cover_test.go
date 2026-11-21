package dbpool

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type recorder struct {
	mu     sync.Mutex
	events []Event
}

func (r *recorder) record(e Event) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, e)
}

func (r *recorder) kinds() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := []string{}
	for _, e := range r.events {
		out = append(out, e.Kind)
	}
	return out
}

func openInstalled(t *testing.T, opt Options) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "pool.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Exec("CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT)").Error; err != nil {
		t.Fatal(err)
	}
	Install(db, opt)
	return db
}

func TestInstalledPoolRecordsExecAndQueryStatements(t *testing.T) {
	rec := &recorder{}
	db := openInstalled(t, Options{Record: rec.record})
	if err := db.Exec("INSERT INTO notes (body) VALUES ('a')").Error; err != nil {
		t.Fatal(err)
	}
	var n int
	if err := db.Raw("SELECT COUNT(*) FROM notes").Scan(&n).Error; err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("count = %d, want 1", n)
	}
	got := rec.kinds()
	want := []string{"exec", "query"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("kinds = %v, want %v", got, want)
	}
	if rec.events[0].SQL != "INSERT INTO notes (body) VALUES ('a')" {
		t.Fatalf("recorded sql = %q", rec.events[0].SQL)
	}
}

func TestTransactionRecordsBeginStatementsAndCommit(t *testing.T) {
	rec := &recorder{}
	db := openInstalled(t, Options{Record: rec.record})
	err := db.Transaction(func(tx *gorm.DB) error {
		return tx.Exec("INSERT INTO notes (body) VALUES ('x')").Error
	})
	if err != nil {
		t.Fatal(err)
	}
	if got, want := rec.kinds(), []string{"begin", "exec", "commit"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("kinds = %v, want %v", got, want)
	}
	var n int
	db.Raw("SELECT COUNT(*) FROM notes").Scan(&n)
	if n != 1 {
		t.Fatalf("committed rows = %d, want 1", n)
	}
}

func TestFailedTransactionRollsBackAndRecordsRollback(t *testing.T) {
	rec := &recorder{}
	db := openInstalled(t, Options{Record: rec.record})
	boom := errors.New("boom")
	err := db.Transaction(func(tx *gorm.DB) error {
		if e := tx.Exec("INSERT INTO notes (body) VALUES ('x')").Error; e != nil {
			return e
		}
		return boom
	})
	if !errors.Is(err, boom) {
		t.Fatalf("err = %v, want boom", err)
	}
	if got, want := rec.kinds(), []string{"begin", "exec", "rollback"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("kinds = %v, want %v", got, want)
	}
	var n int
	db.Raw("SELECT COUNT(*) FROM notes").Scan(&n)
	if n != 0 {
		t.Fatalf("rows after rollback = %d, want 0", n)
	}
}

func TestTransactionHoldsTheTenantSlotUntilItEnds(t *testing.T) {
	gate := NewGate(1).WithMaxWait(5 * time.Second)
	db := openInstalled(t, Options{Gate: gate})
	ctx := WithTenant(context.Background(), "a")

	inTx := make(chan struct{})
	finish := make(chan struct{})
	done := make(chan error, 1)
	go func() {
		done <- db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			close(inTx)
			<-finish
			return nil
		})
	}()
	<-inTx
	if gate.Active() != 1 {
		t.Fatalf("active = %d during the transaction, want 1", gate.Active())
	}

	second := make(chan struct{})
	go func() {
		db.WithContext(ctx).Exec("INSERT INTO notes (body) VALUES ('later')")
		close(second)
	}()
	select {
	case <-second:
		t.Fatal("a second statement for the same tenant ran while the transaction held the only slot")
	case <-time.After(50 * time.Millisecond):
	}
	close(finish)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	select {
	case <-second:
	case <-time.After(2 * time.Second):
		t.Fatal("second statement never ran after the transaction ended")
	}
	if gate.Active() != 0 {
		t.Fatalf("active = %d, want 0", gate.Active())
	}
}

func TestCancelledContextRefusesStatementsWhenTheTenantSlotIsFull(t *testing.T) {
	gate := NewGate(1).WithMaxWait(5 * time.Second)
	db := openInstalled(t, Options{Gate: gate})
	held, _ := gate.Acquire(context.Background(), "a")
	defer held()
	ctx, cancel := context.WithCancel(WithTenant(context.Background(), "a"))
	cancel()

	if err := db.WithContext(ctx).Exec("INSERT INTO notes (body) VALUES ('no')").Error; !errors.Is(err, context.Canceled) {
		t.Fatalf("exec err = %v, want context.Canceled", err)
	}
	var n int
	if err := db.WithContext(ctx).Raw("SELECT COUNT(*) FROM notes").Scan(&n).Error; !errors.Is(err, context.Canceled) {
		t.Fatalf("query err = %v, want context.Canceled", err)
	}
	if err := db.WithContext(ctx).Begin().Error; !errors.Is(err, context.Canceled) {
		t.Fatalf("begin err = %v, want context.Canceled", err)
	}
	if gate.Active() != 1 {
		t.Fatalf("active = %d, want 1: refused calls must not leak slots", gate.Active())
	}
}

func TestStatementsWithoutATenantAreNotGated(t *testing.T) {
	gate := NewGate(1)
	db := openInstalled(t, Options{Gate: gate})
	if err := db.Exec("INSERT INTO notes (body) VALUES ('a')").Error; err != nil {
		t.Fatal(err)
	}
	if gate.Active() != 0 {
		t.Fatalf("active = %d, want 0", gate.Active())
	}
}

func TestGetDBConnStillReachesTheUnderlyingDatabase(t *testing.T) {
	db := openInstalled(t, Options{})
	sqldb, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	var one int
	if err := sqldb.QueryRow("SELECT 1").Scan(&one); err != nil || one != 1 {
		t.Fatalf("one = %d, err = %v", one, err)
	}
}

func TestQueryRowIsRecordedAndStillReturnsRows(t *testing.T) {
	rec := &recorder{}
	db := openInstalled(t, Options{Record: rec.record})
	db.Exec("INSERT INTO notes (body) VALUES ('hello')")
	var body string
	if err := db.Raw("SELECT body FROM notes").Row().Scan(&body); err != nil {
		t.Fatal(err)
	}
	if body != "hello" {
		t.Fatalf("body = %q", body)
	}
	if got := rec.kinds(); got[len(got)-1] != "query" {
		t.Fatalf("kinds = %v, want last query", got)
	}
}

func TestPoolOverANonConnectorBaseRefusesGetDBConnAndTransactions(t *testing.T) {
	p := &pool{base: bareConnPool{}}
	if _, err := p.GetDBConn(); !errors.Is(err, gorm.ErrInvalidDB) {
		t.Fatalf("GetDBConn err = %v, want ErrInvalidDB", err)
	}
	if _, err := p.BeginTx(context.Background(), nil); !errors.Is(err, gorm.ErrInvalidTransaction) {
		t.Fatalf("BeginTx err = %v, want ErrInvalidTransaction", err)
	}
}

type bareConnPool struct{}

func (bareConnPool) PrepareContext(context.Context, string) (*sql.Stmt, error) {
	return nil, errors.New("unused")
}
func (bareConnPool) ExecContext(context.Context, string, ...interface{}) (sql.Result, error) {
	return nil, errors.New("unused")
}
func (bareConnPool) QueryContext(context.Context, string, ...interface{}) (*sql.Rows, error) {
	return nil, errors.New("unused")
}
func (bareConnPool) QueryRowContext(context.Context, string, ...interface{}) *sql.Row {
	return nil
}
