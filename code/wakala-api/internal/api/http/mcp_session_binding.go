package http

import (
	"net/http"
	"sync"
	"time"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/authz"
)

const mcpSessionHeader = "Mcp-Session-Id"

const (
	maxMCPSessionsPerCaller = 1000
	mcpSessionIdleTimeout   = 30 * time.Minute
	mcpSessionOwnerTTL      = 2 * mcpSessionIdleTimeout
)

type sessionOwner struct {
	subject string
	seen    time.Time
	memo    *authz.Memo
}

type sessionOwners struct {
	mu  sync.RWMutex
	by  map[string]sessionOwner
	now func() time.Time
}

func newSessionOwners() *sessionOwners {
	return &sessionOwners{by: map[string]sessionOwner{}, now: func() time.Time { return time.Now() }}
}

func (s *sessionOwners) ownerOf(id string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	held, ok := s.by[id]
	return held.subject, ok
}

func (s *sessionOwners) memoOf(id string) *authz.Memo {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.by[id].memo
}

func (s *sessionOwners) claim(id, subject string) {
	if id == "" || subject == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.dropExpiredLocked()
	if _, held := s.by[id]; !held {
		s.by[id] = sessionOwner{subject: subject, seen: s.now(), memo: authz.NewMemo()}
	}
}

func (s *sessionOwners) touch(id string) {
	if id == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if held, ok := s.by[id]; ok {
		held.seen = s.now()
		s.by[id] = held
	}
}

func (s *sessionOwners) release(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.by, id)
}

func (s *sessionOwners) liveFor(subject string) int {
	if subject == "" {
		return 0
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	cutoff := s.now().Add(-mcpSessionIdleTimeout)
	live := 0
	for _, held := range s.by {
		if held.subject == subject && held.seen.After(cutoff) {
			live++
		}
	}
	return live
}

func (s *sessionOwners) dropExpiredLocked() {
	cutoff := s.now().Add(-mcpSessionOwnerTTL)
	for id, held := range s.by {
		if held.seen.Before(cutoff) {
			delete(s.by, id)
		}
	}
}

type sessionClaimWriter struct {
	http.ResponseWriter
	owners  *sessionOwners
	subject string
	claimed bool
}

func (w *sessionClaimWriter) WriteHeader(code int) {
	w.claim()
	w.ResponseWriter.WriteHeader(code)
}

func (w *sessionClaimWriter) Write(b []byte) (int, error) {
	w.claim()
	return w.ResponseWriter.Write(b)
}

func (w *sessionClaimWriter) claim() {
	if w.claimed {
		return
	}
	w.claimed = true
	w.owners.claim(w.Header().Get(mcpSessionHeader), w.subject)
}

func (w *sessionClaimWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func bindMCPSessions(owners *sessionOwners, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		subject := accounts.IDFromContext(r.Context())
		id := r.Header.Get(mcpSessionHeader)

		if id != "" {
			owner, known := owners.ownerOf(id)
			if known && owner != subject {
				writeErr(w, http.StatusForbidden, "that session belongs to another caller")
				return
			}
			if known && r.Method == http.MethodDelete {
				owners.release(id)
				next(w, r)
				return
			}
			owners.touch(id)
			if memo := owners.memoOf(id); known && memo != nil {
				r = r.WithContext(authz.WithMemo(r.Context(), memo))
			}
		} else if r.Method == http.MethodPost && owners.liveFor(subject) >= maxMCPSessionsPerCaller {
			writeErr(w, http.StatusTooManyRequests, "too many open MCP sessions for this caller")
			return
		}

		next(&sessionClaimWriter{ResponseWriter: w, owners: owners, subject: subject}, r)
	}
}
