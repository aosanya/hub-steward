package throttle

import (
	"testing"
	"time"
)

var t0 = time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

func TestWindowRefusesTheCallPastTheLimitAndSaysHowLongToWait(t *testing.T) {
	w := NewWindow(10, 2, time.Minute)
	for i := 0; i < 2; i++ {
		if ok, _ := w.Allow("a", t0); !ok {
			t.Fatalf("call %d inside the limit was refused", i+1)
		}
	}
	ok, wait := w.Allow("a", t0.Add(20*time.Second))
	if ok {
		t.Fatal("third call inside the window was allowed")
	}
	if wait != 40*time.Second {
		t.Fatalf("wait = %v, want 40s", wait)
	}
}

func TestWindowAllowsAgainOnceTheSpanHasPassed(t *testing.T) {
	w := NewWindow(10, 1, time.Minute)
	w.Allow("a", t0)
	if ok, _ := w.Allow("a", t0.Add(59*time.Second)); ok {
		t.Fatal("allowed before the span ended")
	}
	if ok, _ := w.Allow("a", t0.Add(time.Minute)); !ok {
		t.Fatal("refused at the moment the span ended")
	}
	if ok, _ := w.Allow("a", t0.Add(time.Minute)); ok {
		t.Fatal("new window did not count the call that opened it")
	}
}

func TestWindowCountsEachKeyOnItsOwn(t *testing.T) {
	w := NewWindow(10, 1, time.Minute)
	w.Allow("a", t0)
	if ok, _ := w.Allow("b", t0); !ok {
		t.Fatal("another key was refused because of a")
	}
}

func TestWindowForgetsTheLeastRecentlyUsedKeyAtCapacity(t *testing.T) {
	w := NewWindow(2, 1, time.Hour)
	w.Allow("a", t0)
	w.Allow("b", t0)
	w.Allow("a", t0)
	w.Allow("c", t0)
	if w.Len() != 2 {
		t.Fatalf("Len = %d, want 2", w.Len())
	}
	if ok, _ := w.Allow("b", t0); !ok {
		t.Fatal("b was evicted and should have started a fresh count")
	}
	if ok, _ := w.Allow("c", t0); ok {
		t.Fatal("c was kept and should still be at its limit")
	}
}

func TestZeroLimitRefusesEverything(t *testing.T) {
	w := NewWindow(5, 0, time.Minute)
	if ok, _ := w.Allow("a", t0); ok {
		t.Fatal("a zero limit allowed a call")
	}
}
