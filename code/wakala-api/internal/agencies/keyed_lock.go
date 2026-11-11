package agencies

import "sync"

type keyedLocks struct {
	mu   sync.Mutex
	held map[string]*keyedLock
}

type keyedLock struct {
	mu      sync.Mutex
	waiting int
}

func (l *keyedLocks) acquire(key string) func() {
	l.mu.Lock()
	if l.held == nil {
		l.held = map[string]*keyedLock{}
	}
	lock, ok := l.held[key]
	if !ok {
		lock = &keyedLock{}
		l.held[key] = lock
	}
	lock.waiting++
	l.mu.Unlock()
	lock.mu.Lock()
	return func() {
		lock.mu.Unlock()
		l.mu.Lock()
		lock.waiting--
		if lock.waiting == 0 {
			delete(l.held, key)
		}
		l.mu.Unlock()
	}
}
