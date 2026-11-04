package authz

import (
	"container/list"
	"context"
	"errors"
	"sync"
	"time"
)

const (
	MaxTTL            = 5 * time.Second
	DefaultMaxEntries = 4096
)

type Loader[V any] func(ctx context.Context) (value V, deps []string, err error)

type Cache[V any] struct {
	name    string
	max     int
	ttl     time.Duration
	epochs  *Epochs
	now     func() time.Time
	onEvict func(key string, value V)

	mu      sync.Mutex
	items   map[string]*list.Element
	order   *list.List
	flights map[string]*flight[V]
}

type entry[V any] struct {
	key   string
	value V
	stamp uint64
	deps  []string
	at    time.Time
}

type flight[V any] struct {
	done  chan struct{}
	stamp uint64
	value V
	deps  []string
	err   error
}

type CacheOption[V any] func(*Cache[V])

func WithTTL[V any](ttl time.Duration) CacheOption[V] {
	return func(c *Cache[V]) { c.ttl = ttl }
}

func WithMaxEntries[V any](max int) CacheOption[V] {
	return func(c *Cache[V]) {
		if max > 0 {
			c.max = max
		}
	}
}

func WithClock[V any](now func() time.Time) CacheOption[V] {
	return func(c *Cache[V]) { c.now = now }
}

func WithEvict[V any](f func(key string, value V)) CacheOption[V] {
	return func(c *Cache[V]) { c.onEvict = f }
}

func NewCache[V any](name string, epochs *Epochs, opts ...CacheOption[V]) *Cache[V] {
	c := &Cache[V]{
		name:    name,
		max:     DefaultMaxEntries,
		ttl:     MaxTTL,
		epochs:  epochs,
		now:     time.Now,
		items:   map[string]*list.Element{},
		order:   list.New(),
		flights: map[string]*flight[V]{},
	}
	for _, opt := range opts {
		opt(c)
	}
	if c.ttl > MaxTTL && c.epochs != nil {
		c.ttl = MaxTTL
	}
	return c
}

func (c *Cache[V]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.order.Len()
}

func (c *Cache[V]) fresh(e *entry[V]) bool {
	if c.ttl > 0 && c.now().Sub(e.at) >= c.ttl {
		return false
	}
	if c.epochs != nil && c.epochs.Changed(e.stamp, e.deps...) {
		return false
	}
	return true
}

func (c *Cache[V]) lookupLocked(key string) (V, bool) {
	el, ok := c.items[key]
	if !ok {
		var zero V
		return zero, false
	}
	e := el.Value.(*entry[V])
	if !c.fresh(e) {
		c.removeLocked(el)
		var zero V
		return zero, false
	}
	c.order.MoveToFront(el)
	return e.value, true
}

func (c *Cache[V]) removeLocked(el *list.Element) {
	e := el.Value.(*entry[V])
	c.order.Remove(el)
	delete(c.items, e.key)
	if c.onEvict != nil {
		c.onEvict(e.key, e.value)
	}
}

func (c *Cache[V]) storeLocked(key string, value V, stamp uint64, deps []string) {
	if el, ok := c.items[key]; ok {
		c.removeLocked(el)
	}
	c.items[key] = c.order.PushFront(&entry[V]{key: key, value: value, stamp: stamp, deps: deps, at: c.now()})
	for c.order.Len() > c.max {
		c.removeLocked(c.order.Back())
	}
}

func (c *Cache[V]) Snapshot() map[string]V {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make(map[string]V, len(c.items))
	for key, el := range c.items {
		out[key] = el.Value.(*entry[V]).value
	}
	return out
}

func (c *Cache[V]) Peek(key string) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.lookupLocked(key)
}

func (c *Cache[V]) Put(key string, value V, stamp uint64, deps []string) {
	if c.epochs != nil && c.epochs.Changed(stamp, deps...) {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.storeLocked(key, value, stamp, deps)
}

func (c *Cache[V]) Forget(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if el, ok := c.items[key]; ok {
		c.removeLocked(el)
	}
}

func (c *Cache[V]) Purge() {
	c.mu.Lock()
	defer c.mu.Unlock()
	for c.order.Len() > 0 {
		c.removeLocked(c.order.Back())
	}
}

func (c *Cache[V]) stamp() uint64 {
	if c.epochs == nil {
		return 0
	}
	return c.epochs.Stamp()
}

func (c *Cache[V]) Get(ctx context.Context, key string, load Loader[V]) (V, error) {
	memo := MemoFrom(ctx)
	if c.epochs == nil {
		memo = nil
	}
	memoKey := c.name + "\x00" + key
	if memo != nil {
		if v, ok := memo.get(memoKey, c.epochs); ok {
			if value, typed := v.(V); typed {
				return value, nil
			}
		}
	}
	value, stamp, deps, err := c.fetch(ctx, key, load)
	if err == nil && memo != nil {
		memo.put(memoKey, value, stamp, deps)
	}
	return value, err
}

func (c *Cache[V]) fetch(ctx context.Context, key string, load Loader[V]) (V, uint64, []string, error) {
	for attempt := 0; ; attempt++ {
		c.mu.Lock()
		if el, ok := c.items[key]; ok {
			if e := el.Value.(*entry[V]); c.fresh(e) {
				c.order.MoveToFront(el)
				c.mu.Unlock()
				return e.value, e.stamp, e.deps, nil
			}
			c.removeLocked(el)
		}
		if f, ok := c.flights[key]; ok && (c.epochs == nil || c.epochs.Stamp() == f.stamp) {
			c.mu.Unlock()
			select {
			case <-f.done:
			case <-ctx.Done():
				var zero V
				return zero, 0, nil, ctx.Err()
			}
			if f.err == nil {
				return f.value, f.stamp, f.deps, nil
			}
			if attempt == 0 && ctx.Err() == nil && (errors.Is(f.err, context.Canceled) || errors.Is(f.err, context.DeadlineExceeded)) {
				continue
			}
			var zero V
			return zero, 0, nil, f.err
		}
		f := &flight[V]{done: make(chan struct{}), stamp: c.stamp()}
		c.flights[key] = f
		c.mu.Unlock()
		return c.lead(ctx, key, f, load)
	}
}

func (c *Cache[V]) lead(ctx context.Context, key string, f *flight[V], load Loader[V]) (V, uint64, []string, error) {
	value, deps, err := load(ctx)
	f.value, f.deps, f.err = value, deps, err
	c.mu.Lock()
	if c.flights[key] == f {
		delete(c.flights, key)
	}
	if err == nil && (c.epochs == nil || !c.epochs.Changed(f.stamp, deps...)) {
		c.storeLocked(key, value, f.stamp, deps)
	}
	c.mu.Unlock()
	close(f.done)
	return value, f.stamp, deps, err
}
