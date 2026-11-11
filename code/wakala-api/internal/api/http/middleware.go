package http

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"sync"
	"time"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/apikeys"
	"wakalaserver/internal/authz"
	"wakalaserver/internal/session"
	"wakalaserver/internal/throttle"
)

// requireSession refuses a request with no valid wakala_session cookie —
// gates API key management (WK8): a leaked key must never be usable to
// mint or revoke another one, so that surface is session-only, unlike
// callers.require below.
func requireSession(sessions session.Manager, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(sessionCookieName)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "not signed in")
			return
		}
		sess, err := sessions.Verify(r.Context(), c.Value)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "not signed in")
			return
		}
		next(w, r.WithContext(accounts.WithID(r.Context(), sess.MemberID)))
	}
}

type projectUsers interface {
	User(ctx context.Context, token string) (string, error)
}

type callers struct {
	sessions session.Manager
	keys     apikeys.Manager
	project  projectUsers
	verified *verifiedTokens
	seen     MemberSessionsSeen
	// challenge names the protected resource metadata a refusal points an
	// OAuth client at, so it can find the authorization server to sign in to
	// rather than being told only that it is unauthenticated (RFC 9728).
	challenge func(*http.Request) string
}

func (c callers) pointingAt(metadataURL func(*http.Request) string) callers {
	c.challenge = metadataURL
	return c
}

func (c callers) refuse(w http.ResponseWriter, r *http.Request) {
	if c.challenge != nil {
		if url := c.challenge(r); url != "" {
			w.Header().Set("WWW-Authenticate", `Bearer resource_metadata="`+url+`"`)
		}
	}
	writeErr(w, http.StatusUnauthorized, "authentication required")
}

func asCaller(r *http.Request, id string) *http.Request {
	return r.WithContext(authz.EnsureMemo(accounts.WithID(r.Context(), id)))
}

func (c callers) require(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := c.identify(r, c.projectUserSeen)
		if !ok {
			c.refuse(w, r)
			return
		}
		next(w, asCaller(r, id))
	}
}

func (c callers) recognises(r *http.Request) bool {
	_, ok := c.identify(r, c.projectUser)
	return ok
}

func (c callers) identify(r *http.Request, projectIdentity func(context.Context, string) (string, bool)) (string, bool) {
	if tok, ok := bearerToken(r); ok {
		if c.keys != nil {
			if key, err := c.keys.Verify(r.Context(), tok); err == nil {
				return key.AccountID, true
			}
		}
		if id, ok := projectIdentity(r.Context(), tok); ok {
			return id, true
		}
	}
	if cookie, err := r.Cookie(sessionCookieName); err == nil && c.sessions != nil {
		if sess, err := c.sessions.Verify(r.Context(), cookie.Value); err == nil {
			return sess.MemberID, true
		}
	}
	return "", false
}

func (c callers) projectUser(ctx context.Context, token string) (string, bool) {
	if c.project == nil {
		return "", false
	}
	if c.verified != nil {
		if id, ok := c.verified.get(token); ok {
			return id, true
		}
		if c.verified.wasRefused(token) {
			return "", false
		}
	}
	id, err := c.project.User(ctx, token)
	if err != nil || id == "" {
		if c.verified != nil {
			c.verified.refuse(token)
		}
		return "", false
	}
	if c.verified != nil {
		c.verified.put(token, id)
	}
	return id, true
}

func (c callers) projectUserSeen(ctx context.Context, token string) (string, bool) {
	id, ok := c.projectUser(ctx, token)
	if ok && c.seen != nil {
		if session := sessionClaimOf(token); session != "" {
			_ = c.seen.Touch(ctx, id, session)
		}
	}
	return id, ok
}

// verifiedTokens remembers, briefly, that a project accepted a token. One MCP
// conversation is many requests and each one would otherwise cost a round trip
// to the project's GoTrue; the window is short so a revoked token stops
// working in seconds rather than at its own expiry. Tokens are keyed by digest
// so the map never holds a usable credential.
type verifiedTokens struct {
	ttl     time.Duration
	mu      sync.Mutex
	seen    map[string]verifiedToken
	refused map[string]time.Time
}

type verifiedToken struct {
	id    string
	until time.Time
}

func newVerifiedTokens(ttl time.Duration) *verifiedTokens {
	return &verifiedTokens{ttl: ttl, seen: map[string]verifiedToken{}, refused: map[string]time.Time{}}
}

func digest(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (v *verifiedTokens) get(token string) (string, bool) {
	v.mu.Lock()
	defer v.mu.Unlock()
	found, ok := v.seen[digest(token)]
	if !ok || time.Now().After(found.until) {
		return "", false
	}
	return found.id, true
}

func (v *verifiedTokens) put(token, id string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if len(v.seen) > 256 {
		for key, found := range v.seen {
			if time.Now().After(found.until) {
				delete(v.seen, key)
			}
		}
	}
	v.seen[digest(token)] = verifiedToken{id: id, until: time.Now().Add(v.ttl)}
}

func (v *verifiedTokens) wasRefused(token string) bool {
	v.mu.Lock()
	defer v.mu.Unlock()
	until, ok := v.refused[digest(token)]
	return ok && time.Now().Before(until)
}

func (v *verifiedTokens) refuse(token string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	now := time.Now()
	if len(v.refused) >= throttle.RefusedBearersRemembered {
		for key, until := range v.refused {
			if now.After(until) {
				delete(v.refused, key)
			}
		}
	}
	for key := range v.refused {
		if len(v.refused) < throttle.RefusedBearersRemembered {
			break
		}
		delete(v.refused, key)
	}
	v.refused[digest(token)] = now.Add(throttle.RefusedBearerMemory)
}

func (v *verifiedTokens) forget(token string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	delete(v.seen, digest(token))
}

func bearerToken(r *http.Request) (string, bool) {
	const prefix = "Bearer "
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(h, prefix) {
		return "", false
	}
	return strings.TrimPrefix(h, prefix), true
}
