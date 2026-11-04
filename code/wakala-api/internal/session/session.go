package session

import (
	"context"
	"crypto/hmac"
	cryptorand "crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	mwanachamaauth "wakalaserver/modules/auth"
)

var ErrInvalidToken = errors.New("session: invalid token")

const TouchEvery = time.Minute

const (
	MaxSessionsPerMember = 200
	SweepEvery           = time.Minute
)

type Session struct {
	Token     string    `json:"token"`
	MemberID  string    `json:"member_id"`
	IssuedAt  time.Time `json:"issued_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

type Manager interface {
	Mint(ctx context.Context, memberID string, ttl time.Duration) (Session, error)
	Verify(ctx context.Context, token string) (Session, error)
	Revoke(ctx context.Context, token string) error
}

type payload struct {
	MemberID  string `json:"m"`
	IssuedAt  int64  `json:"i"`
	ExpiresAt int64  `json:"e"`
	Nonce     string `json:"n"`
}

type userAgentKey struct{}

func WithUserAgent(ctx context.Context, userAgent string) context.Context {
	return context.WithValue(ctx, userAgentKey{}, userAgent)
}

func userAgentOf(ctx context.Context) string {
	ua, _ := ctx.Value(userAgentKey{}).(string)
	return ua
}

type HMACManager struct {
	secret []byte
	mu     sync.RWMutex
	live   map[string]Session
	held   map[string][]string
	swept  time.Time
	now    func() time.Time
	rand   func() string
	ledger mwanachamaauth.SessionRepository
}

func NewHMACManager(secret []byte, now func() time.Time, rand func() string) *HMACManager {
	if now == nil {
		now = time.Now
	}
	if rand == nil {
		rand = cryptoNonce
	}
	return &HMACManager{
		secret: secret,
		live:   map[string]Session{},
		held:   map[string][]string{},
		now:    now,
		rand:   rand,
	}
}

func (m *HMACManager) KeptIn(ledger mwanachamaauth.SessionRepository) *HMACManager {
	m.ledger = ledger
	return m
}

func (m *HMACManager) Mint(ctx context.Context, memberID string, ttl time.Duration) (Session, error) {
	if memberID == "" {
		return Session{}, errors.New("session: memberID required")
	}
	now := m.now()
	p := payload{
		MemberID:  memberID,
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(ttl).Unix(),
		Nonce:     m.rand(),
	}
	raw, err := json.Marshal(p)
	if err != nil {
		return Session{}, err
	}
	body := b64(raw)
	token := body + "." + m.sign(body)
	s := Session{
		Token:     token,
		MemberID:  memberID,
		IssuedAt:  now,
		ExpiresAt: time.Unix(p.ExpiresAt, 0),
	}
	if m.ledger != nil {
		started, err := m.ledger.Start(ctx, mwanachamaauth.SessionStart{
			SubjectID: memberID,
			Token:     token,
			UserAgent: userAgentOf(ctx),
			At:        now,
			ExpiresAt: s.ExpiresAt,
		})
		if err != nil {
			return Session{}, err
		}
		m.endLeastRecentlyUsedBeyondCap(ctx, memberID, started.ID, now)
		return s, nil
	}
	m.mu.Lock()
	m.sweepExpired(now)
	m.live[token] = s
	m.held[memberID] = append(m.held[memberID], token)
	for len(m.held[memberID]) > MaxSessionsPerMember {
		delete(m.live, m.held[memberID][0])
		m.held[memberID] = m.held[memberID][1:]
	}
	m.mu.Unlock()
	return s, nil
}

func (m *HMACManager) sweepExpired(now time.Time) {
	if now.Sub(m.swept) < SweepEvery {
		return
	}
	m.swept = now
	for token, s := range m.live {
		if !now.Before(s.ExpiresAt) {
			delete(m.live, token)
		}
	}
	for member, tokens := range m.held {
		kept := tokens[:0]
		for _, token := range tokens {
			if _, ok := m.live[token]; ok {
				kept = append(kept, token)
			}
		}
		if len(kept) == 0 {
			delete(m.held, member)
			continue
		}
		m.held[member] = kept
	}
}

func (m *HMACManager) endLeastRecentlyUsedBeyondCap(ctx context.Context, memberID, keepID string, now time.Time) {
	live, err := m.ledger.ListLive(ctx, memberID, now)
	if err != nil || len(live) <= MaxSessionsPerMember {
		return
	}
	candidates := make([]mwanachamaauth.SessionRecord, 0, len(live))
	for _, rec := range live {
		if rec.ID != keepID {
			candidates = append(candidates, rec)
		}
	}
	sort.Slice(candidates, func(i, j int) bool {
		if !candidates[i].LastUsedAt.Equal(candidates[j].LastUsedAt) {
			return candidates[i].LastUsedAt.Before(candidates[j].LastUsedAt)
		}
		return candidates[i].StartedAt.Before(candidates[j].StartedAt)
	})
	for _, rec := range candidates[:len(live)-MaxSessionsPerMember] {
		_ = m.ledger.End(ctx, memberID, rec.ID, now)
	}
}

func (m *HMACManager) Verify(ctx context.Context, token string) (Session, error) {
	p, err := m.signed(token)
	if err != nil {
		return Session{}, err
	}
	now := m.now()
	if now.Unix() >= p.ExpiresAt {
		return Session{}, ErrInvalidToken
	}
	if m.ledger != nil {
		return m.verifyKept(ctx, token, p, now)
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.live[token]
	if !ok {
		return Session{}, ErrInvalidToken
	}
	m.forget(s.MemberID, token)
	m.held[s.MemberID] = append(m.held[s.MemberID], token)
	return s, nil
}

func (m *HMACManager) verifyKept(ctx context.Context, token string, p payload, now time.Time) (Session, error) {
	rec, err := m.ledger.ByToken(ctx, token, now)
	if errors.Is(err, mwanachamaauth.ErrSessionNotFound) {
		return Session{}, ErrInvalidToken
	}
	if err != nil {
		return Session{}, err
	}
	if rec.SubjectID != p.MemberID {
		return Session{}, ErrInvalidToken
	}
	if now.Sub(rec.LastUsedAt) >= TouchEvery {
		_ = m.ledger.Touch(ctx, rec.ID, now)
	}
	return Session{
		Token:     token,
		MemberID:  p.MemberID,
		IssuedAt:  time.Unix(p.IssuedAt, 0),
		ExpiresAt: time.Unix(p.ExpiresAt, 0),
	}, nil
}

func (m *HMACManager) signed(token string) (payload, error) {
	i := strings.LastIndexByte(token, '.')
	if i < 0 {
		return payload{}, ErrInvalidToken
	}
	body, sig := token[:i], token[i+1:]
	if !hmac.Equal([]byte(sig), []byte(m.sign(body))) {
		return payload{}, ErrInvalidToken
	}
	raw, err := base64.RawURLEncoding.DecodeString(body)
	if err != nil {
		return payload{}, ErrInvalidToken
	}
	var p payload
	if err := json.Unmarshal(raw, &p); err != nil {
		return payload{}, ErrInvalidToken
	}
	return p, nil
}

func (m *HMACManager) Revoke(ctx context.Context, token string) error {
	if m.ledger != nil {
		now := m.now()
		rec, err := m.ledger.ByToken(ctx, token, now)
		if errors.Is(err, mwanachamaauth.ErrSessionNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		return m.ledger.End(ctx, rec.SubjectID, rec.ID, now)
	}
	m.mu.Lock()
	if s, ok := m.live[token]; ok {
		m.forget(s.MemberID, token)
	}
	delete(m.live, token)
	m.mu.Unlock()
	return nil
}

func (m *HMACManager) forget(memberID, token string) {
	kept := m.held[memberID][:0]
	for _, t := range m.held[memberID] {
		if t != token {
			kept = append(kept, t)
		}
	}
	if len(kept) == 0 {
		delete(m.held, memberID)
		return
	}
	m.held[memberID] = kept
}

func (m *HMACManager) sign(body string) string {
	h := hmac.New(sha256.New, m.secret)
	h.Write([]byte(body))
	return b64(h.Sum(nil))
}

func b64(b []byte) string {
	return base64.RawURLEncoding.EncodeToString(b)
}

func cryptoNonce() string {
	b := make([]byte, 16)
	if _, err := cryptorand.Read(b); err != nil {
		panic("session: crypto/rand unavailable: " + err.Error())
	}
	return b64(b)
}
