package authz

import (
	"context"
	"testing"
	"time"
)

func TestMemoFromIsNilWithoutOne(t *testing.T) {
	if MemoFrom(context.Background()) != nil {
		t.Fatal("expected nil memo")
	}
}

func TestEnsureMemoKeepsAnExistingMemo(t *testing.T) {
	first := EnsureMemo(context.Background())
	second := EnsureMemo(first)
	if MemoFrom(first) != MemoFrom(second) || MemoFrom(first) == nil {
		t.Fatal("ensure must reuse the memo already on the context")
	}
}

func TestWithMemoAttachesTheGivenMemo(t *testing.T) {
	m := NewMemo()
	if MemoFrom(WithMemo(context.Background(), m)) != m {
		t.Fatal("memo not attached")
	}
}

func TestMemoEntryExpiresAfterTTL(t *testing.T) {
	clock := newFakeClock()
	m := NewMemo()
	m.now = clock.now
	m.put("k", "v", 0, nil)
	if v, ok := m.get("k", nil); !ok || v != "v" {
		t.Fatalf("fresh get %v %v", v, ok)
	}
	clock.advance(MaxTTL)
	if _, ok := m.get("k", nil); ok {
		t.Fatal("expired entry served")
	}
	if m.Len() != 0 {
		t.Fatalf("expired entry kept, len %d", m.Len())
	}
}

func TestMemoEntryDroppedWhenDependencyBumped(t *testing.T) {
	epochs := NewEpochs()
	m := NewMemo()
	m.put("k", "v", epochs.Stamp(), []string{CredentialKey("c1")})
	epochs.Bump(CredentialKey("c1"))
	if _, ok := m.get("k", epochs); ok {
		t.Fatal("bumped dependency must invalidate")
	}
}

func TestMemoAtCapacityDropsExpiredThenEverything(t *testing.T) {
	clock := newFakeClock()
	m := NewMemo()
	m.now = clock.now
	for i := 0; i < memoMaxEntries; i++ {
		m.put(string(rune('a'+i%26))+time.Duration(i).String(), i, 0, nil)
	}
	if m.Len() != memoMaxEntries {
		t.Fatalf("len %d", m.Len())
	}
	clock.advance(MaxTTL)
	m.put("fresh", 1, 0, nil)
	if m.Len() != 1 {
		t.Fatalf("expired entries should be swept, len %d", m.Len())
	}
	full := NewMemo()
	for i := 0; i < memoMaxEntries; i++ {
		full.put(time.Duration(i).String(), i, 0, nil)
	}
	full.put("overflow", 1, 0, nil)
	if full.Len() != 1 {
		t.Fatalf("a full memo of live entries is cleared before the new one is kept, len %d", full.Len())
	}
}
