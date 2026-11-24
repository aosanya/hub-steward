package agencies

import (
	"context"
	"sync"
	"testing"
	"time"

	mwanachamataskmanager "github.com/aosanya/mwanachama-backend-taskmanager"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func promiseOutcomesDB(t *testing.T) *promiseOutcomes {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	if err := migratePromiseOutcomes(db); err != nil {
		t.Fatal(err)
	}
	return newPromiseOutcomes(db)
}

func TestFirstClaimOfATaskWinsAndKeepsItsOutcomeAndNote(t *testing.T) {
	p := promiseOutcomesDB(t)
	ctx := context.Background()
	first, won, err := p.claim(ctx, "task-1", PromiseKept, "done on time")
	if err != nil || !won {
		t.Fatalf("first claim: won=%v err=%v", won, err)
	}
	if first.Outcome != "kept" || first.Note != "done on time" || first.TaskID != "task-1" {
		t.Fatalf("first claim returned %+v", first)
	}
	held, won, err := p.claim(ctx, "task-1", PromiseNotKept, "too late")
	if err != nil || won {
		t.Fatalf("second claim: won=%v err=%v", won, err)
	}
	if held.Outcome != "kept" || held.Note != "done on time" {
		t.Fatalf("second claim must read back the first, got %+v", held)
	}
}

func TestClaimsOfDifferentTasksDoNotCollide(t *testing.T) {
	p := promiseOutcomesDB(t)
	ctx := context.Background()
	if _, won, err := p.claim(ctx, "task-1", PromiseKept, ""); err != nil || !won {
		t.Fatalf("task-1: won=%v err=%v", won, err)
	}
	other, won, err := p.claim(ctx, "task-2", PromisePartlyKept, "half")
	if err != nil || !won || other.Outcome != "partly_kept" {
		t.Fatalf("task-2: %+v won=%v err=%v", other, won, err)
	}
}

func TestReleaseLetsTheTaskBeClaimedAgainWithTheNewOutcome(t *testing.T) {
	p := promiseOutcomesDB(t)
	ctx := context.Background()
	if _, _, err := p.claim(ctx, "task-1", PromiseKept, "first"); err != nil {
		t.Fatal(err)
	}
	if err := p.release(ctx, "task-1"); err != nil {
		t.Fatal(err)
	}
	again, won, err := p.claim(ctx, "task-1", PromiseNotKept, "second")
	if err != nil || !won {
		t.Fatalf("claim after release: won=%v err=%v", won, err)
	}
	if again.Outcome != "not_kept" || again.Note != "second" {
		t.Fatalf("got %+v", again)
	}
}

func TestReleaseOfAnUnclaimedTaskIsQuietAndLeavesOthersAlone(t *testing.T) {
	p := promiseOutcomesDB(t)
	ctx := context.Background()
	if _, _, err := p.claim(ctx, "task-2", PromiseKept, ""); err != nil {
		t.Fatal(err)
	}
	if err := p.release(ctx, "task-1"); err != nil {
		t.Fatalf("release of nothing: %v", err)
	}
	held, won, err := p.claim(ctx, "task-2", PromiseNotKept, "")
	if err != nil || won || held.Outcome != "kept" {
		t.Fatalf("task-2 must still be held as kept: %+v won=%v err=%v", held, won, err)
	}
}

func TestClaimWithoutADatabaseAlwaysWinsAndReleaseIsANoop(t *testing.T) {
	p := newPromiseOutcomes(nil)
	ctx := context.Background()
	for i := 0; i < 2; i++ {
		got, won, err := p.claim(ctx, "task-1", PromiseKept, "n")
		if err != nil || !won {
			t.Fatalf("claim %d: won=%v err=%v", i, won, err)
		}
		if got.TaskID != "task-1" || got.Outcome != "kept" || got.Note != "n" {
			t.Fatalf("claim %d returned %+v", i, got)
		}
		if time.Since(got.CreatedAt) > time.Minute || got.CreatedAt.Location() != time.UTC {
			t.Fatalf("created at must be a recent UTC time, got %v", got.CreatedAt)
		}
	}
	if err := p.release(ctx, "task-1"); err != nil {
		t.Fatal(err)
	}
}

func TestClaimAndReleaseSurfaceDatabaseFailures(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	p := newPromiseOutcomes(db)
	ctx := context.Background()
	if _, won, err := p.claim(ctx, "task-1", PromiseKept, ""); err == nil || won {
		t.Fatalf("claim on an unmigrated database must fail, won=%v err=%v", won, err)
	}
	if err := p.release(ctx, "task-1"); err == nil {
		t.Fatal("release on an unmigrated database must fail")
	}
}

func TestPromiseOutcomesOfFallsBackToAnUnclaimedStoreForABoardThatHasNone(t *testing.T) {
	var plain mwanachamataskmanager.TaskManager
	if got := promiseOutcomesOf(plain); got != unclaimedPromiseOutcomes {
		t.Fatal("a board with no outcomes must use the unclaimed store")
	}
	if got := promiseOutcomesOf(limitedBoard{}); got != unclaimedPromiseOutcomes {
		t.Fatal("a limited board with nil outcomes must use the unclaimed store")
	}
	mine := newPromiseOutcomes(nil)
	if got := promiseOutcomesOf(limitedBoard{outcomes: mine}); got != mine {
		t.Fatal("a limited board must hand back its own outcomes")
	}
}

func TestHoldSerialisesOneTaskAndLetsAnotherThrough(t *testing.T) {
	p := newPromiseOutcomes(nil)
	release := p.hold("task-1")
	otherRelease := p.hold("task-2")
	otherRelease()

	entered := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		r := p.hold("task-1")
		close(entered)
		r()
	}()
	select {
	case <-entered:
		t.Fatal("second hold of the same task must wait for the first")
	case <-time.After(50 * time.Millisecond):
	}
	release()
	select {
	case <-entered:
	case <-time.After(2 * time.Second):
		t.Fatal("second hold must proceed once the first is released")
	}
	wg.Wait()
	p.locks.mu.Lock()
	defer p.locks.mu.Unlock()
	if len(p.locks.held) != 0 {
		t.Fatalf("released locks must be forgotten, %d remain", len(p.locks.held))
	}
}
