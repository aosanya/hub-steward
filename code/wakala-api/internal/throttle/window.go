package throttle

import (
	"container/list"
	"sync"
	"time"
)

type Window struct {
	mu       sync.Mutex
	entries  map[string]*list.Element
	order    *list.List
	capacity int
	limit    int
	span     time.Duration
}

type windowEntry struct {
	key   string
	start time.Time
	count int
}

func NewWindow(capacity, limit int, span time.Duration) *Window {
	return &Window{
		entries:  map[string]*list.Element{},
		order:    list.New(),
		capacity: capacity,
		limit:    limit,
		span:     span,
	}
}

func (w *Window) Allow(key string, now time.Time) (bool, time.Duration) {
	w.mu.Lock()
	defer w.mu.Unlock()
	e := w.entry(key, now)
	if now.Sub(e.start) >= w.span {
		e.start, e.count = now, 0
	}
	if e.count >= w.limit {
		return false, e.start.Add(w.span).Sub(now)
	}
	e.count++
	return true, 0
}

func (w *Window) Len() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return len(w.entries)
}

func (w *Window) entry(key string, now time.Time) *windowEntry {
	if el, ok := w.entries[key]; ok {
		w.order.MoveToFront(el)
		return el.Value.(*windowEntry)
	}
	for len(w.entries) >= w.capacity {
		oldest := w.order.Back()
		w.order.Remove(oldest)
		delete(w.entries, oldest.Value.(*windowEntry).key)
	}
	e := &windowEntry{key: key, start: now}
	w.entries[key] = w.order.PushFront(e)
	return e
}
