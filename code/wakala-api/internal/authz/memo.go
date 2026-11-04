package authz

import (
	"context"
	"sync"
	"time"
)

const memoMaxEntries = 256

type Memo struct {
	mu     sync.Mutex
	ttl    time.Duration
	now    func() time.Time
	values map[string]memoEntry
}

type memoEntry struct {
	value any
	stamp uint64
	deps  []string
	at    time.Time
}

func NewMemo() *Memo {
	return &Memo{ttl: MaxTTL, now: time.Now, values: map[string]memoEntry{}}
}

func (m *Memo) get(key string, epochs *Epochs) (any, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.values[key]
	if !ok {
		return nil, false
	}
	if m.now().Sub(e.at) >= m.ttl || (epochs != nil && epochs.Changed(e.stamp, e.deps...)) {
		delete(m.values, key)
		return nil, false
	}
	return e.value, true
}

func (m *Memo) put(key string, value any, stamp uint64, deps []string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.values) >= memoMaxEntries {
		m.dropExpiredLocked()
	}
	m.values[key] = memoEntry{value: value, stamp: stamp, deps: deps, at: m.now()}
}

func (m *Memo) dropExpiredLocked() {
	now := m.now()
	for key, e := range m.values {
		if now.Sub(e.at) >= m.ttl {
			delete(m.values, key)
		}
	}
	if len(m.values) >= memoMaxEntries {
		m.values = map[string]memoEntry{}
	}
}

func (m *Memo) Len() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.values)
}

type memoKey struct{}

func WithMemo(ctx context.Context, m *Memo) context.Context {
	return context.WithValue(ctx, memoKey{}, m)
}

func EnsureMemo(ctx context.Context) context.Context {
	if MemoFrom(ctx) != nil {
		return ctx
	}
	return WithMemo(ctx, NewMemo())
}

func MemoFrom(ctx context.Context) *Memo {
	m, _ := ctx.Value(memoKey{}).(*Memo)
	return m
}
