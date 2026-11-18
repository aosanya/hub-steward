package authz

import (
	"testing"
	"time"
)

type fakeClock struct{ t time.Time }

func (f *fakeClock) now() time.Time          { return f.t }
func (f *fakeClock) advance(d time.Duration) { f.t = f.t.Add(d) }

func newFakeClock() *fakeClock { return &fakeClock{t: time.Unix(1_700_000_000, 0)} }

func TestKeyBuildersPrefixEachKind(t *testing.T) {
	if SubjectKey("ann") != "s:ann" || TenantKey("acme") != "t:acme" || CredentialKey("k1") != "c:k1" {
		t.Fatalf("keys: %q %q %q", SubjectKey("ann"), TenantKey("acme"), CredentialKey("k1"))
	}
}

func TestStampStartsAtZeroAndRisesOnEveryBump(t *testing.T) {
	e := NewEpochs()
	if e.Stamp() != 0 {
		t.Fatalf("fresh stamp %d", e.Stamp())
	}
	e.Bump(SubjectKey("a"))
	e.Bump()
	if e.Stamp() != 2 {
		t.Fatalf("stamp after two bumps %d", e.Stamp())
	}
}

func TestChangedOnlyForBumpedDependency(t *testing.T) {
	e := NewEpochs()
	stamp := e.Stamp()
	e.Bump(SubjectKey("ann"))
	if !e.Changed(stamp, SubjectKey("ann")) {
		t.Fatal("bumped subject should read as changed")
	}
	if e.Changed(stamp, SubjectKey("bob"), TenantKey("acme")) {
		t.Fatal("unrelated keys must not read as changed")
	}
	if e.Changed(stamp) {
		t.Fatal("no dependencies means nothing can have changed")
	}
}

func TestChangedIsFalseOnceStampCatchesUp(t *testing.T) {
	e := NewEpochs()
	e.Bump(TenantKey("acme"))
	if e.Changed(e.Stamp(), TenantKey("acme")) {
		t.Fatal("a stamp taken after the bump must not see it as a change")
	}
}

func TestGlobalBumpInvalidatesEveryDependency(t *testing.T) {
	e := NewEpochs()
	stamp := e.Stamp()
	e.Bump(Global)
	if !e.Changed(stamp, CredentialKey("anything")) {
		t.Fatal("global bump should change any dependency")
	}
	if !e.Changed(stamp) {
		t.Fatal("global bump should change even a dependency-free read")
	}
}

func TestTrackedCountsDistinctKeys(t *testing.T) {
	e := NewEpochs()
	e.Bump("a", "b")
	e.Bump("a")
	if e.Tracked() != 2 {
		t.Fatalf("tracked %d", e.Tracked())
	}
}

func TestPruneDropsKeysOlderThanRetention(t *testing.T) {
	clock := newFakeClock()
	e := NewEpochs(WithMaxBumps(2), WithEpochClock(clock.now))
	e.Bump("old1", "old2")
	clock.advance(DefaultRetention + time.Second)
	e.Bump("new")
	if e.Tracked() != 1 {
		t.Fatalf("tracked %d, want only the fresh key", e.Tracked())
	}
	if !e.Changed(0, "new") {
		t.Fatal("fresh key must still invalidate")
	}
}

func TestPruneOverflowRaisesFloorSoOldStampsAreAllStale(t *testing.T) {
	clock := newFakeClock()
	e := NewEpochs(WithMaxBumps(2), WithEpochClock(clock.now))
	e.Bump("a")
	stamp := e.Stamp()
	e.Bump("b", "c", "d")
	if e.Tracked() != 0 {
		t.Fatalf("overflow within retention should clear the map, tracked %d", e.Tracked())
	}
	if !e.Changed(stamp, "unrelated") {
		t.Fatal("a stamp older than the floor must read as changed even for unrelated keys")
	}
	if e.Changed(e.Stamp(), "unrelated") {
		t.Fatal("a stamp taken after the prune is current")
	}
}

func TestWithMaxBumpsIgnoresNonPositive(t *testing.T) {
	e := NewEpochs(WithMaxBumps(0), WithMaxBumps(-3))
	if e.max != DefaultMaxBumps {
		t.Fatalf("max %d", e.max)
	}
}
