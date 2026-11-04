package session

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"time"

	mwanachamaauth "wakalaserver/modules/auth"

	"wakalaserver/internal/authz"
)

type identity struct {
	memberID  string
	issuedAt  time.Time
	expiresAt time.Time
}

type Cached struct {
	Manager
	epochs *authz.Epochs
	cache  *authz.Cache[identity]
	now    func() time.Time
}

func NewCached(inner Manager, epochs *authz.Epochs, opts ...authz.CacheOption[identity]) *Cached {
	return &Cached{Manager: inner, epochs: epochs, cache: authz.NewCache[identity]("sessions", epochs, opts...), now: time.Now}
}

func digestOf(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (c *Cached) Verify(ctx context.Context, token string) (Session, error) {
	key := digestOf(token)
	who, err := c.cache.Get(ctx, key, func(ctx context.Context) (identity, []string, error) {
		s, err := c.Manager.Verify(ctx, token)
		if err != nil {
			return identity{}, nil, err
		}
		return identity{memberID: s.MemberID, issuedAt: s.IssuedAt, expiresAt: s.ExpiresAt}, []string{authz.SubjectKey(s.MemberID)}, nil
	})
	if err != nil {
		return Session{}, err
	}
	if !who.expiresAt.IsZero() && !c.now().Before(who.expiresAt) {
		c.cache.Forget(key)
		return Session{}, ErrInvalidToken
	}
	return Session{Token: token, MemberID: who.memberID, IssuedAt: who.issuedAt, ExpiresAt: who.expiresAt}, nil
}

func (c *Cached) Revoke(ctx context.Context, token string) error {
	key := digestOf(token)
	if who, ok := c.cache.Peek(key); ok {
		defer c.epochs.Bump(authz.SubjectKey(who.memberID))
	}
	defer c.cache.Forget(key)
	return c.Manager.Revoke(ctx, token)
}

type Ledger struct {
	mwanachamaauth.SessionRepository
	epochs *authz.Epochs
}

func NewLedger(inner mwanachamaauth.SessionRepository, epochs *authz.Epochs) *Ledger {
	return &Ledger{SessionRepository: inner, epochs: epochs}
}

func (l *Ledger) End(ctx context.Context, subjectID, id string, at time.Time) error {
	defer l.epochs.Bump(authz.SubjectKey(subjectID))
	return l.SessionRepository.End(ctx, subjectID, id, at)
}
