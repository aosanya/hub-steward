package throttle

import (
	"container/list"
	"sync"
	"time"
)

type Strikes struct {
	mu        sync.Mutex
	entries   map[string]*list.Element
	order     *list.List
	capacity  int
	lockAfter int
	lockFor   time.Duration
}

type Strike struct {
	Failed      int
	LockedUntil time.Time
}

func (s Strike) Locked(now time.Time) bool {
	return !s.LockedUntil.IsZero() && now.Before(s.LockedUntil)
}

func (s Strike) TriesLeft(lockAfter int) int {
	if n := lockAfter - s.Failed; n > 0 {
		return n
	}
	return 0
}

type entry struct {
	key    string
	strike Strike
	last   time.Time
}

func NewStrikes(capacity, lockAfter int, lockFor time.Duration) *Strikes {
	return &Strikes{
		entries:   map[string]*list.Element{},
		order:     list.New(),
		capacity:  capacity,
		lockAfter: lockAfter,
		lockFor:   lockFor,
	}
}

func (s *Strikes) LockAfter() int { return s.lockAfter }

func (s *Strikes) Take(key string, now time.Time) (Strike, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e := s.fresh(key, now)
	if e.strike.Locked(now) {
		return e.strike, false
	}
	e.strike.Failed++
	e.last = now
	if e.strike.Failed >= s.lockAfter {
		e.strike.LockedUntil = now.Add(s.lockFor)
	}
	return e.strike, true
}

func (s *Strikes) Clear(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if el, ok := s.entries[key]; ok {
		s.order.Remove(el)
		delete(s.entries, key)
	}
}

func (s *Strikes) Len() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.entries)
}

func (s *Strikes) fresh(key string, now time.Time) *entry {
	if el, ok := s.entries[key]; ok {
		e := el.Value.(*entry)
		if s.idle(e, now) {
			e.strike = Strike{}
		}
		s.order.MoveToFront(el)
		return e
	}
	for len(s.entries) >= s.capacity {
		s.evictOldest()
	}
	e := &entry{key: key, last: now}
	s.entries[key] = s.order.PushFront(e)
	return e
}

func (s *Strikes) idle(e *entry, now time.Time) bool {
	if e.strike.Locked(now) {
		return false
	}
	return now.Sub(e.last) >= s.lockFor
}

func (s *Strikes) evictOldest() {
	oldest := s.order.Back()
	if oldest == nil {
		return
	}
	s.order.Remove(oldest)
	delete(s.entries, oldest.Value.(*entry).key)
}
