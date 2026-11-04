package dbpool

import (
	"context"
	"sync"
	"sync/atomic"
	"time"
)

const (
	DefaultTenantLimit = 4
	DefaultMaxWait     = 10 * time.Second
)

type tenantKey struct{}

type slotKey struct{}

type Slot struct{ tenant atomic.Pointer[string] }

func WithTenant(ctx context.Context, tenant string) context.Context {
	if tenant == "" {
		return ctx
	}
	return context.WithValue(ctx, tenantKey{}, tenant)
}

func WithSlot(ctx context.Context) context.Context {
	return context.WithValue(ctx, slotKey{}, &Slot{})
}

func Bind(ctx context.Context, tenant string) {
	if slot, ok := ctx.Value(slotKey{}).(*Slot); ok && tenant != "" {
		slot.tenant.Store(&tenant)
	}
}

func TenantOf(ctx context.Context) string {
	if slot, ok := ctx.Value(slotKey{}).(*Slot); ok {
		if tenant := slot.tenant.Load(); tenant != nil {
			return *tenant
		}
	}
	tenant, _ := ctx.Value(tenantKey{}).(string)
	return tenant
}

type Gate struct {
	limit   int
	maxWait time.Duration

	mu    sync.Mutex
	slots map[string]*slot
}

type slot struct {
	held chan struct{}
	refs int
}

func NewGate(limit int) *Gate {
	if limit < 1 {
		limit = DefaultTenantLimit
	}
	return &Gate{limit: limit, maxWait: DefaultMaxWait, slots: map[string]*slot{}}
}

func (g *Gate) WithMaxWait(d time.Duration) *Gate {
	g.maxWait = d
	return g
}

func (g *Gate) Active() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return len(g.slots)
}

func (g *Gate) Acquire(ctx context.Context, tenant string) (func(), error) {
	if tenant == "" {
		return func() {}, nil
	}
	g.mu.Lock()
	s, ok := g.slots[tenant]
	if !ok {
		s = &slot{held: make(chan struct{}, g.limit)}
		g.slots[tenant] = s
	}
	s.refs++
	g.mu.Unlock()

	timer := time.NewTimer(g.maxWait)
	defer timer.Stop()
	select {
	case s.held <- struct{}{}:
		return once(func() {
			<-s.held
			g.unref(tenant, s)
		}), nil
	case <-timer.C:
		g.unref(tenant, s)
		return func() {}, nil
	case <-ctx.Done():
		g.unref(tenant, s)
		return nil, ctx.Err()
	}
}

func (g *Gate) unref(tenant string, s *slot) {
	g.mu.Lock()
	defer g.mu.Unlock()
	s.refs--
	if s.refs == 0 && g.slots[tenant] == s {
		delete(g.slots, tenant)
	}
}
