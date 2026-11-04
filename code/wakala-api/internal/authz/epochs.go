package authz

import (
	"sync"
	"sync/atomic"
	"time"
)

const (
	Global           = "*"
	DefaultMaxBumps  = 8192
	DefaultRetention = time.Minute
)

func SubjectKey(subject string) string { return "s:" + subject }

func TenantKey(tenant string) string { return "t:" + tenant }

func CredentialKey(credential string) string { return "c:" + credential }

type bump struct {
	seq uint64
	at  time.Time
}

type Epochs struct {
	seq atomic.Uint64

	mu        sync.Mutex
	bumped    map[string]bump
	floor     uint64
	max       int
	retention time.Duration
	now       func() time.Time
}

type EpochOption func(*Epochs)

func WithMaxBumps(max int) EpochOption {
	return func(e *Epochs) {
		if max > 0 {
			e.max = max
		}
	}
}

func WithEpochClock(now func() time.Time) EpochOption {
	return func(e *Epochs) { e.now = now }
}

func NewEpochs(opts ...EpochOption) *Epochs {
	e := &Epochs{bumped: map[string]bump{}, max: DefaultMaxBumps, retention: DefaultRetention, now: time.Now}
	for _, opt := range opts {
		opt(e)
	}
	return e
}

func (e *Epochs) Stamp() uint64 { return e.seq.Load() }

func (e *Epochs) Bump(keys ...string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	n := e.seq.Add(1)
	at := e.now()
	for _, key := range keys {
		e.bumped[key] = bump{seq: n, at: at}
	}
	if len(e.bumped) > e.max {
		e.prune(at)
	}
}

func (e *Epochs) prune(at time.Time) {
	cutoff := at.Add(-e.retention)
	for key, b := range e.bumped {
		if b.at.Before(cutoff) {
			delete(e.bumped, key)
		}
	}
	if len(e.bumped) <= e.max {
		return
	}
	for _, b := range e.bumped {
		if b.seq > e.floor {
			e.floor = b.seq
		}
	}
	e.bumped = map[string]bump{}
}

func (e *Epochs) Changed(stamp uint64, keys ...string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.floor > stamp {
		return true
	}
	if b, ok := e.bumped[Global]; ok && b.seq > stamp {
		return true
	}
	for _, key := range keys {
		if b, ok := e.bumped[key]; ok && b.seq > stamp {
			return true
		}
	}
	return false
}

func (e *Epochs) Tracked() int {
	e.mu.Lock()
	defer e.mu.Unlock()
	return len(e.bumped)
}
