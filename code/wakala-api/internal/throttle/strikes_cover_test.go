package throttle

import (
	"testing"
	"time"
)

func TestStrikesLockOnTheStrikeThatReachesTheLimit(t *testing.T) {
	s := NewStrikes(10, 3, 15*time.Minute)
	for i := 1; i <= 2; i++ {
		st, ok := s.Take("c", t0)
		if !ok || st.Failed != i || st.Locked(t0) {
			t.Fatalf("strike %d: %+v ok=%v", i, st, ok)
		}
	}
	st, ok := s.Take("c", t0)
	if !ok || !st.Locked(t0) || st.Failed != 3 {
		t.Fatalf("third strike should lock: %+v ok=%v", st, ok)
	}
	if !st.LockedUntil.Equal(t0.Add(15 * time.Minute)) {
		t.Fatalf("LockedUntil = %v", st.LockedUntil)
	}
}

func TestStrikesRefuseWhileLockedWithoutCountingFurther(t *testing.T) {
	s := NewStrikes(10, 1, time.Minute)
	s.Take("c", t0)
	st, ok := s.Take("c", t0.Add(30*time.Second))
	if ok {
		t.Fatal("a locked key was allowed another try")
	}
	if st.Failed != 1 {
		t.Fatalf("Failed = %d, want 1", st.Failed)
	}
}

func TestStrikesStartOverAfterTheLockEnds(t *testing.T) {
	s := NewStrikes(10, 2, time.Minute)
	s.Take("c", t0)
	s.Take("c", t0)
	st, ok := s.Take("c", t0.Add(time.Minute))
	if !ok || st.Failed != 1 || st.Locked(t0.Add(time.Minute)) {
		t.Fatalf("after the lock: %+v ok=%v", st, ok)
	}
}

func TestStrikesForgetAnIdleKeysFailures(t *testing.T) {
	s := NewStrikes(10, 3, time.Minute)
	s.Take("c", t0)
	s.Take("c", t0)
	st, _ := s.Take("c", t0.Add(2*time.Minute))
	if st.Failed != 1 {
		t.Fatalf("Failed = %d, want 1 after idling", st.Failed)
	}
}

func TestStrikesKeepFailuresWithinTheIdlePeriod(t *testing.T) {
	s := NewStrikes(10, 3, time.Minute)
	s.Take("c", t0)
	st, _ := s.Take("c", t0.Add(59*time.Second))
	if st.Failed != 2 {
		t.Fatalf("Failed = %d, want 2", st.Failed)
	}
}

func TestStrikesClearForgetsOnlyThatKey(t *testing.T) {
	s := NewStrikes(10, 3, time.Minute)
	s.Take("a", t0)
	s.Take("b", t0)
	s.Clear("a")
	s.Clear("missing")
	if s.Len() != 1 {
		t.Fatalf("Len = %d, want 1", s.Len())
	}
	st, _ := s.Take("a", t0)
	if st.Failed != 1 {
		t.Fatalf("a after Clear: Failed = %d", st.Failed)
	}
	st, _ = s.Take("b", t0)
	if st.Failed != 2 {
		t.Fatalf("b was cleared too: Failed = %d", st.Failed)
	}
}

func TestStrikesEvictTheLeastRecentlyUsedKeyAtCapacity(t *testing.T) {
	s := NewStrikes(2, 5, time.Hour)
	s.Take("a", t0)
	s.Take("b", t0)
	s.Take("a", t0)
	s.Take("c", t0)
	if s.Len() != 2 {
		t.Fatalf("Len = %d", s.Len())
	}
	if st, _ := s.Take("b", t0); st.Failed != 1 {
		t.Fatalf("b should have been evicted, Failed = %d", st.Failed)
	}
}

func TestTriesLeftNeverGoesBelowZero(t *testing.T) {
	if got := (Strike{Failed: 2}).TriesLeft(5); got != 3 {
		t.Fatalf("TriesLeft = %d, want 3", got)
	}
	if got := (Strike{Failed: 9}).TriesLeft(5); got != 0 {
		t.Fatalf("TriesLeft = %d, want 0", got)
	}
}

func TestZeroStrikeIsNeverLocked(t *testing.T) {
	if (Strike{}).Locked(t0) {
		t.Fatal("zero strike reported locked")
	}
}

func TestLockAfterReportsTheConfiguredLimit(t *testing.T) {
	if got := NewStrikes(1, 7, time.Minute).LockAfter(); got != 7 {
		t.Fatalf("LockAfter = %d", got)
	}
}
