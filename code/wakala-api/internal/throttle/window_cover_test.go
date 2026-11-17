package throttle

import (
	"testing"
	"time"
)

func TestWindowAllowsUpToTheLimitThenRefusesWithTimeToWait(t *testing.T) {
	w := NewWindow(10, 2, time.Minute)
	for i := 0; i < 2; i++ {
		if ok, wait := w.Allow("k", epoch); !ok || wait != 0 {
			t.Fatalf("call %d: ok=%v wait=%v", i, ok, wait)
		}
	}
	ok, wait := w.Allow("k", epoch.Add(20*time.Second))
	if ok || wait != 40*time.Second {
		t.Fatalf("want refused with 40s wait, got ok=%v wait=%v", ok, wait)
	}
}

func TestWindowReopensOnceTheSpanHasPassed(t *testing.T) {
	w := NewWindow(10, 1, time.Minute)
	w.Allow("k", epoch)
	if ok, _ := w.Allow("k", epoch.Add(59*time.Second)); ok {
		t.Fatal("still inside the window")
	}
	if ok, _ := w.Allow("k", epoch.Add(time.Minute)); !ok {
		t.Fatal("a new window must open at the span")
	}
	if ok, _ := w.Allow("k", epoch.Add(time.Minute)); ok {
		t.Fatal("the new window counts from its own start")
	}
}

func TestWindowKeysAreIndependent(t *testing.T) {
	w := NewWindow(10, 1, time.Minute)
	w.Allow("a", epoch)
	if ok, _ := w.Allow("b", epoch); !ok {
		t.Fatal("another key has its own allowance")
	}
}

func TestWindowEvictsTheLeastRecentlyUsedKeyAtCapacity(t *testing.T) {
	w := NewWindow(2, 1, time.Hour)
	w.Allow("a", epoch)
	w.Allow("b", epoch)
	w.Allow("a", epoch)
	w.Allow("c", epoch)
	if w.Len() != 2 {
		t.Fatalf("len %d", w.Len())
	}
	if ok, _ := w.Allow("b", epoch); !ok {
		t.Fatal("b was evicted so it starts a new allowance")
	}
	if ok, _ := w.Allow("c", epoch); ok {
		t.Fatal("c was kept so it is still spent")
	}
}

func TestWindowRefusedCallsAreNotCounted(t *testing.T) {
	w := NewWindow(10, 1, time.Minute)
	w.Allow("k", epoch)
	for i := 0; i < 5; i++ {
		w.Allow("k", epoch.Add(10*time.Second))
	}
	if ok, _ := w.Allow("k", epoch.Add(time.Minute)); !ok {
		t.Fatal("refusals must not extend the window")
	}
}
