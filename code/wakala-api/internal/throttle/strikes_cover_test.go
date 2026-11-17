package throttle

import (
	"testing"
	"time"
)

var epoch = time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

func TestStrikesCountFailuresAndLockOnTheThreshold(t *testing.T) {
	s := NewStrikes(10, 3, time.Minute)
	for want := 1; want <= 2; want++ {
		got, ok := s.Take("a", epoch)
		if !ok || got.Failed != want || got.Locked(epoch) {
			t.Fatalf("take %d: got %+v ok=%v", want, got, ok)
		}
	}
	got, ok := s.Take("a", epoch)
	if !ok || got.Failed != 3 || !got.Locked(epoch) {
		t.Fatalf("third take must lock: %+v ok=%v", got, ok)
	}
	if !got.LockedUntil.Equal(epoch.Add(time.Minute)) {
		t.Fatalf("locked until %v", got.LockedUntil)
	}
}

func TestStrikesRefuseWhileLockedAndDoNotCountFurther(t *testing.T) {
	s := NewStrikes(10, 1, time.Minute)
	s.Take("a", epoch)
	got, ok := s.Take("a", epoch.Add(30*time.Second))
	if ok {
		t.Fatal("take during lock must be refused")
	}
	if got.Failed != 1 {
		t.Fatalf("failed count moved during lock: %d", got.Failed)
	}
}

func TestStrikesLockExpiresAndStartsFresh(t *testing.T) {
	s := NewStrikes(10, 2, time.Minute)
	s.Take("a", epoch)
	s.Take("a", epoch)
	got, ok := s.Take("a", epoch.Add(time.Minute))
	if !ok || got.Failed != 1 || got.Locked(epoch.Add(time.Minute)) {
		t.Fatalf("after expiry want a fresh first strike: %+v ok=%v", got, ok)
	}
}

func TestStrikesIdleKeyForgetsEarlierFailures(t *testing.T) {
	s := NewStrikes(10, 3, time.Minute)
	s.Take("a", epoch)
	s.Take("a", epoch.Add(10*time.Second))
	got, _ := s.Take("a", epoch.Add(10*time.Second+time.Minute))
	if got.Failed != 1 {
		t.Fatalf("idle for a full lock span must reset, got %d", got.Failed)
	}
}

func TestStrikesRecentFailuresAccumulateBelowIdleSpan(t *testing.T) {
	s := NewStrikes(10, 3, time.Minute)
	s.Take("a", epoch)
	got, _ := s.Take("a", epoch.Add(59*time.Second))
	if got.Failed != 2 {
		t.Fatalf("want 2 got %d", got.Failed)
	}
}

func TestStrikesKeysAreIndependent(t *testing.T) {
	s := NewStrikes(10, 1, time.Minute)
	s.Take("a", epoch)
	if _, ok := s.Take("b", epoch); !ok {
		t.Fatal("locking one key must not lock another")
	}
}

func TestStrikesClearForgetsAKeyAndIgnoresUnknownOnes(t *testing.T) {
	s := NewStrikes(10, 1, time.Minute)
	s.Take("a", epoch)
	s.Clear("missing")
	if s.Len() != 1 {
		t.Fatalf("len %d", s.Len())
	}
	s.Clear("a")
	if s.Len() != 0 {
		t.Fatalf("len %d", s.Len())
	}
	if got, ok := s.Take("a", epoch); !ok || got.Failed != 1 {
		t.Fatalf("cleared key must start over: %+v ok=%v", got, ok)
	}
}

func TestStrikesEvictTheLeastRecentlyUsedKeyAtCapacity(t *testing.T) {
	s := NewStrikes(2, 5, time.Minute)
	s.Take("a", epoch)
	s.Take("b", epoch)
	s.Take("a", epoch)
	s.Take("c", epoch)
	if s.Len() != 2 {
		t.Fatalf("len %d", s.Len())
	}
	if got, _ := s.Take("b", epoch); got.Failed != 1 {
		t.Fatalf("b should have been evicted and restarted, got %d", got.Failed)
	}
	if got, _ := s.Take("c", epoch); got.Failed != 2 {
		t.Fatalf("c should still be tracked, got %d", got.Failed)
	}
}

func TestStrikesReportTheirLockAfter(t *testing.T) {
	if got := NewStrikes(1, 7, time.Second).LockAfter(); got != 7 {
		t.Fatalf("got %d", got)
	}
}

func TestStrikeLockedIsFalseForTheZeroValueAndAtTheBoundary(t *testing.T) {
	if (Strike{}).Locked(epoch) {
		t.Fatal("zero strike must not be locked")
	}
	s := Strike{LockedUntil: epoch}
	if s.Locked(epoch) {
		t.Fatal("lock ends at the instant it names")
	}
	if !s.Locked(epoch.Add(-time.Nanosecond)) {
		t.Fatal("lock holds before the instant it names")
	}
}

func TestStrikeTriesLeftNeverGoesBelowZero(t *testing.T) {
	cases := []struct{ failed, after, want int }{{0, 5, 5}, {2, 5, 3}, {5, 5, 0}, {9, 5, 0}}
	for _, c := range cases {
		if got := (Strike{Failed: c.failed}).TriesLeft(c.after); got != c.want {
			t.Errorf("failed %d after %d: got %d want %d", c.failed, c.after, got, c.want)
		}
	}
}
