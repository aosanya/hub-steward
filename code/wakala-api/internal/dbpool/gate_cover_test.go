package dbpool

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestTenantOfIsEmptyWithoutAnythingBound(t *testing.T) {
	if got := TenantOf(context.Background()); got != "" {
		t.Fatalf("tenant = %q, want empty", got)
	}
}

func TestWithTenantIgnoresAnEmptyTenant(t *testing.T) {
	base := WithTenant(context.Background(), "a")
	if got := TenantOf(WithTenant(base, "")); got != "a" {
		t.Fatalf("tenant = %q, want a kept", got)
	}
}

func TestBoundSlotOutranksTheContextTenant(t *testing.T) {
	ctx := WithSlot(WithTenant(context.Background(), "from-context"))
	if got := TenantOf(ctx); got != "from-context" {
		t.Fatalf("before bind tenant = %q", got)
	}
	Bind(ctx, "from-slot")
	if got := TenantOf(ctx); got != "from-slot" {
		t.Fatalf("after bind tenant = %q", got)
	}
}

func TestBindWithEmptyTenantLeavesTheSlotAlone(t *testing.T) {
	ctx := WithSlot(context.Background())
	Bind(ctx, "a")
	Bind(ctx, "")
	if got := TenantOf(ctx); got != "a" {
		t.Fatalf("tenant = %q, want a", got)
	}
}

func TestBindWithoutASlotChangesNothing(t *testing.T) {
	ctx := WithTenant(context.Background(), "a")
	Bind(ctx, "b")
	if got := TenantOf(ctx); got != "a" {
		t.Fatalf("tenant = %q, want a", got)
	}
}

func TestBindOnASharedSlotIsSeenByDerivedContexts(t *testing.T) {
	ctx := WithSlot(context.Background())
	child, cancel := context.WithCancel(ctx)
	defer cancel()
	Bind(ctx, "late")
	if got := TenantOf(child); got != "late" {
		t.Fatalf("tenant = %q, want late", got)
	}
}

func TestNewGateFallsBackToTheDefaultLimit(t *testing.T) {
	for _, limit := range []int{0, -3} {
		g := NewGate(limit)
		if g.limit != DefaultTenantLimit {
			t.Fatalf("limit %d gave %d, want %d", limit, g.limit, DefaultTenantLimit)
		}
		if g.maxWait != DefaultMaxWait {
			t.Fatalf("maxWait = %v", g.maxWait)
		}
	}
	if NewGate(7).limit != 7 {
		t.Fatal("explicit limit not kept")
	}
}

func TestAcquireWithoutATenantNeverBlocksOrTracks(t *testing.T) {
	g := NewGate(1)
	for i := 0; i < 3; i++ {
		release, err := g.Acquire(context.Background(), "")
		if err != nil {
			t.Fatal(err)
		}
		release()
	}
	if g.Active() != 0 {
		t.Fatalf("active = %d, want 0", g.Active())
	}
}

func TestAcquireTracksActiveTenantsUntilReleased(t *testing.T) {
	g := NewGate(2)
	a1, _ := g.Acquire(context.Background(), "a")
	a2, _ := g.Acquire(context.Background(), "a")
	b, _ := g.Acquire(context.Background(), "b")
	if g.Active() != 2 {
		t.Fatalf("active = %d, want 2", g.Active())
	}
	a1()
	if g.Active() != 2 {
		t.Fatalf("active = %d after one release of a, want 2", g.Active())
	}
	a2()
	b()
	if g.Active() != 0 {
		t.Fatalf("active = %d, want 0", g.Active())
	}
}

func TestReleaseIsIdempotent(t *testing.T) {
	g := NewGate(1)
	release, _ := g.Acquire(context.Background(), "a")
	release()
	release()
	again, err := g.Acquire(context.Background(), "a")
	if err != nil {
		t.Fatal(err)
	}
	again()
	if g.Active() != 0 {
		t.Fatalf("active = %d, want 0", g.Active())
	}
}

func TestAcquireBlocksAtTheLimitUntilAHolderReleases(t *testing.T) {
	g := NewGate(1).WithMaxWait(5 * time.Second)
	first, _ := g.Acquire(context.Background(), "a")
	got := make(chan func(), 1)
	go func() {
		release, _ := g.Acquire(context.Background(), "a")
		got <- release
	}()
	select {
	case <-got:
		t.Fatal("second acquire got through while the limit was held")
	case <-time.After(50 * time.Millisecond):
	}
	first()
	select {
	case release := <-got:
		release()
	case <-time.After(2 * time.Second):
		t.Fatal("second acquire never got through after release")
	}
	if g.Active() != 0 {
		t.Fatalf("active = %d, want 0", g.Active())
	}
}

func TestOneTenantAtItsLimitDoesNotBlockAnother(t *testing.T) {
	g := NewGate(1)
	a, _ := g.Acquire(context.Background(), "a")
	defer a()
	done := make(chan struct{})
	go func() {
		release, _ := g.Acquire(context.Background(), "b")
		release()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("tenant b was blocked by tenant a")
	}
}

func TestAcquireGivesUpAfterMaxWaitAndLetsTheCallThrough(t *testing.T) {
	g := NewGate(1).WithMaxWait(20 * time.Millisecond)
	held, _ := g.Acquire(context.Background(), "a")
	release, err := g.Acquire(context.Background(), "a")
	if err != nil {
		t.Fatalf("err = %v, want nil after the wait runs out", err)
	}
	release()
	held()
	if g.Active() != 0 {
		t.Fatalf("active = %d, want 0", g.Active())
	}
}

func TestTimedOutAcquireReleaseDoesNotFreeTheRealHolder(t *testing.T) {
	g := NewGate(1).WithMaxWait(10 * time.Millisecond)
	held, _ := g.Acquire(context.Background(), "a")
	timedOut, _ := g.Acquire(context.Background(), "a")
	timedOut()
	if g.Active() != 1 {
		t.Fatalf("active = %d, want 1 while the real holder remains", g.Active())
	}
	held()
}

func TestAcquireReturnsTheContextErrorWhenCancelled(t *testing.T) {
	g := NewGate(1).WithMaxWait(5 * time.Second)
	held, _ := g.Acquire(context.Background(), "a")
	defer held()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	release, err := g.Acquire(ctx, "a")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
	if release != nil {
		t.Fatal("release should be nil on cancellation")
	}
	if g.Active() != 1 {
		t.Fatalf("active = %d, want 1: the cancelled waiter must not leak a slot", g.Active())
	}
}
