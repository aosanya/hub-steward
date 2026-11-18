package authz

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func constLoader(value string, deps ...string) Loader[string] {
	return func(context.Context) (string, []string, error) { return value, deps, nil }
}

func TestGetLoadsOnceThenServesFromCache(t *testing.T) {
	c := NewCache[string]("roles", NewEpochs())
	var calls int
	load := func(context.Context) (string, []string, error) { calls++; return "admin", nil, nil }
	for i := 0; i < 3; i++ {
		v, err := c.Get(context.Background(), "ann", load)
		if err != nil || v != "admin" {
			t.Fatalf("get: %q %v", v, err)
		}
	}
	if calls != 1 {
		t.Fatalf("loader ran %d times", calls)
	}
}

func TestGetReloadsAfterDependencyBump(t *testing.T) {
	epochs := NewEpochs()
	c := NewCache[string]("roles", epochs)
	current := "viewer"
	load := func(context.Context) (string, []string, error) {
		return current, []string{SubjectKey("ann")}, nil
	}
	v, _ := c.Get(context.Background(), "ann", load)
	if v != "viewer" {
		t.Fatalf("first %q", v)
	}
	current = "admin"
	if v, _ = c.Get(context.Background(), "ann", load); v != "viewer" {
		t.Fatalf("unbumped cache should still serve %q", v)
	}
	epochs.Bump(SubjectKey("ann"))
	if v, _ = c.Get(context.Background(), "ann", load); v != "admin" {
		t.Fatalf("after bump got %q", v)
	}
}

func TestBumpOfOtherSubjectKeepsEntry(t *testing.T) {
	epochs := NewEpochs()
	c := NewCache[string]("roles", epochs)
	var calls int
	load := func(context.Context) (string, []string, error) {
		calls++
		return "x", []string{SubjectKey("ann")}, nil
	}
	c.Get(context.Background(), "ann", load)
	epochs.Bump(SubjectKey("bob"))
	c.Get(context.Background(), "ann", load)
	if calls != 1 {
		t.Fatalf("loader ran %d times", calls)
	}
}

func TestEntryExpiresAfterTTL(t *testing.T) {
	clock := newFakeClock()
	c := NewCache[string]("roles", nil, WithTTL[string](time.Second), WithClock[string](clock.now))
	var calls int
	load := func(context.Context) (string, []string, error) { calls++; return "v", nil, nil }
	c.Get(context.Background(), "k", load)
	clock.advance(999 * time.Millisecond)
	c.Get(context.Background(), "k", load)
	if calls != 1 {
		t.Fatalf("before ttl loader ran %d", calls)
	}
	clock.advance(time.Millisecond)
	c.Get(context.Background(), "k", load)
	if calls != 2 {
		t.Fatalf("at ttl loader ran %d", calls)
	}
}

func TestTTLIsCappedWhenEpochsAreInUse(t *testing.T) {
	withEpochs := NewCache[string]("a", NewEpochs(), WithTTL[string](time.Hour))
	if withEpochs.ttl != MaxTTL {
		t.Fatalf("ttl %v", withEpochs.ttl)
	}
	standalone := NewCache[string]("b", nil, WithTTL[string](time.Hour))
	if standalone.ttl != time.Hour {
		t.Fatalf("standalone ttl %v", standalone.ttl)
	}
}

func TestLoaderErrorIsReturnedAndNotCached(t *testing.T) {
	c := NewCache[string]("roles", NewEpochs())
	boom := errors.New("db down")
	var calls int
	load := func(context.Context) (string, []string, error) {
		calls++
		if calls == 1 {
			return "", nil, boom
		}
		return "ok", nil, nil
	}
	if _, err := c.Get(context.Background(), "k", load); !errors.Is(err, boom) {
		t.Fatalf("err %v", err)
	}
	if c.Len() != 0 {
		t.Fatalf("failure cached, len %d", c.Len())
	}
	if v, err := c.Get(context.Background(), "k", load); err != nil || v != "ok" {
		t.Fatalf("retry %q %v", v, err)
	}
}

func TestLeastRecentlyUsedEntryIsEvictedAtCapacity(t *testing.T) {
	var evicted []string
	c := NewCache[string]("roles", nil, WithMaxEntries[string](2), WithEvict(func(k string, _ string) { evicted = append(evicted, k) }))
	ctx := context.Background()
	c.Get(ctx, "a", constLoader("1"))
	c.Get(ctx, "b", constLoader("2"))
	c.Get(ctx, "a", constLoader("1"))
	c.Get(ctx, "c", constLoader("3"))
	if len(evicted) != 1 || evicted[0] != "b" {
		t.Fatalf("evicted %v", evicted)
	}
	if _, ok := c.Peek("a"); !ok {
		t.Fatal("recently used a should survive")
	}
	if _, ok := c.Peek("b"); ok {
		t.Fatal("b should be gone")
	}
}

func TestWithMaxEntriesIgnoresNonPositive(t *testing.T) {
	c := NewCache[string]("x", nil, WithMaxEntries[string](0))
	if c.max != DefaultMaxEntries {
		t.Fatalf("max %d", c.max)
	}
}

func TestPutRefusedWhenStampIsAlreadyStale(t *testing.T) {
	epochs := NewEpochs()
	c := NewCache[string]("roles", epochs)
	stamp := epochs.Stamp()
	epochs.Bump(SubjectKey("ann"))
	c.Put("ann", "old", stamp, []string{SubjectKey("ann")})
	if _, ok := c.Peek("ann"); ok {
		t.Fatal("stale put must be dropped")
	}
	c.Put("ann", "new", epochs.Stamp(), []string{SubjectKey("ann")})
	if v, ok := c.Peek("ann"); !ok || v != "new" {
		t.Fatalf("peek %q %v", v, ok)
	}
}

func TestPeekDropsStaleEntryAndNotifiesEvict(t *testing.T) {
	epochs := NewEpochs()
	var evicted int
	c := NewCache[string]("roles", epochs, WithEvict(func(string, string) { evicted++ }))
	c.Put("k", "v", epochs.Stamp(), []string{TenantKey("acme")})
	epochs.Bump(TenantKey("acme"))
	if _, ok := c.Peek("k"); ok {
		t.Fatal("stale entry must not be returned")
	}
	if evicted != 1 || c.Len() != 0 {
		t.Fatalf("evicted %d len %d", evicted, c.Len())
	}
}

func TestForgetAndPurgeRemoveEntries(t *testing.T) {
	var evicted []string
	c := NewCache[string]("roles", nil, WithEvict(func(k string, _ string) { evicted = append(evicted, k) }))
	c.Put("a", "1", 0, nil)
	c.Put("b", "2", 0, nil)
	c.Put("c", "3", 0, nil)
	c.Forget("a")
	c.Forget("missing")
	if c.Len() != 2 {
		t.Fatalf("len %d", c.Len())
	}
	c.Purge()
	if c.Len() != 0 || len(evicted) != 3 {
		t.Fatalf("len %d evicted %v", c.Len(), evicted)
	}
}

func TestPutOverwritingKeyReplacesValueAndEvictsOld(t *testing.T) {
	var evictedValues []string
	c := NewCache[string]("roles", nil, WithEvict(func(_ string, v string) { evictedValues = append(evictedValues, v) }))
	c.Put("k", "one", 0, nil)
	c.Put("k", "two", 0, nil)
	if v, _ := c.Peek("k"); v != "two" || len(evictedValues) != 1 || evictedValues[0] != "one" {
		t.Fatalf("value %q evicted %v", v, evictedValues)
	}
}

func TestSnapshotCopiesValues(t *testing.T) {
	c := NewCache[string]("roles", nil)
	c.Put("a", "1", 0, nil)
	c.Put("b", "2", 0, nil)
	snap := c.Snapshot()
	if len(snap) != 2 || snap["a"] != "1" || snap["b"] != "2" {
		t.Fatalf("snapshot %v", snap)
	}
	delete(snap, "a")
	if c.Len() != 2 {
		t.Fatal("mutating the snapshot must not touch the cache")
	}
}

func TestConcurrentGetsShareOneLoad(t *testing.T) {
	c := NewCache[string]("roles", NewEpochs())
	release := make(chan struct{})
	started := make(chan struct{})
	var calls atomic.Int32
	load := func(context.Context) (string, []string, error) {
		if calls.Add(1) == 1 {
			close(started)
		}
		<-release
		return "shared", nil, nil
	}
	var wg sync.WaitGroup
	results := make([]string, 4)
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			results[i], _ = c.Get(context.Background(), "k", load)
		}(i)
		if i == 0 {
			<-started
		}
	}
	time.Sleep(50 * time.Millisecond)
	close(release)
	wg.Wait()
	for _, r := range results {
		if r != "shared" {
			t.Fatalf("results %v", results)
		}
	}
	if calls.Load() != 1 {
		t.Fatalf("loader ran %d times", calls.Load())
	}
}

func TestWaiterGivesUpWhenItsContextEnds(t *testing.T) {
	c := NewCache[string]("roles", NewEpochs())
	release := make(chan struct{})
	started := make(chan struct{})
	go c.Get(context.Background(), "k", func(context.Context) (string, []string, error) {
		close(started)
		<-release
		return "v", nil, nil
	})
	<-started
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := c.Get(ctx, "k", constLoader("other"))
	close(release)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err %v", err)
	}
}

func TestLoadFinishingAfterBumpIsServedButNotCached(t *testing.T) {
	epochs := NewEpochs()
	c := NewCache[string]("roles", epochs)
	load := func(context.Context) (string, []string, error) {
		epochs.Bump(SubjectKey("ann"))
		return "raced", []string{SubjectKey("ann")}, nil
	}
	v, err := c.Get(context.Background(), "ann", load)
	if err != nil || v != "raced" {
		t.Fatalf("get %q %v", v, err)
	}
	if c.Len() != 0 {
		t.Fatal("a result computed across a bump must not be cached")
	}
}

func TestMemoServesRepeatedReadsWithinOneRequest(t *testing.T) {
	epochs := NewEpochs()
	c := NewCache[string]("roles", epochs)
	ctx := EnsureMemo(context.Background())
	var calls int
	load := func(context.Context) (string, []string, error) {
		calls++
		return "v", []string{SubjectKey("ann")}, nil
	}
	c.Get(ctx, "ann", load)
	c.Purge()
	c.Get(ctx, "ann", load)
	if calls != 1 {
		t.Fatalf("memo should serve the second read, loader ran %d", calls)
	}
	epochs.Bump(SubjectKey("ann"))
	c.Get(ctx, "ann", load)
	if calls != 2 {
		t.Fatalf("bump must invalidate the memo, loader ran %d", calls)
	}
}

func TestMemoIsSeparatedByCacheName(t *testing.T) {
	epochs := NewEpochs()
	a := NewCache[string]("a", epochs)
	b := NewCache[string]("b", epochs)
	ctx := EnsureMemo(context.Background())
	va, _ := a.Get(ctx, "k", constLoader("from-a"))
	vb, _ := b.Get(ctx, "k", constLoader("from-b"))
	if va != "from-a" || vb != "from-b" {
		t.Fatalf("%q %q", va, vb)
	}
}

func TestMemoIsIgnoredWithoutEpochs(t *testing.T) {
	c := NewCache[string]("roles", nil)
	ctx := EnsureMemo(context.Background())
	c.Get(ctx, "k", constLoader("v"))
	if MemoFrom(ctx).Len() != 0 {
		t.Fatal("a cache without epochs must not write to the memo")
	}
}
