package apikeys

import (
	"context"
	"crypto/sha256"
	"encoding/hex"

	"wakalaserver/internal/authz"
)

type Cached struct {
	Manager
	epochs *authz.Epochs
	cache  *authz.Cache[Key]
}

func NewCached(inner Manager, epochs *authz.Epochs, opts ...authz.CacheOption[Key]) *Cached {
	return &Cached{Manager: inner, epochs: epochs, cache: authz.NewCache[Key]("apikeys", epochs, opts...)}
}

func digestOf(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func (c *Cached) Verify(ctx context.Context, token string) (Key, error) {
	return c.cache.Get(ctx, digestOf(token), func(ctx context.Context) (Key, []string, error) {
		key, err := c.Manager.Verify(ctx, token)
		if err != nil {
			return Key{}, nil, err
		}
		return key, []string{authz.CredentialKey(key.ID), authz.SubjectKey(key.AccountID)}, nil
	})
}

func (c *Cached) Revoke(ctx context.Context, id string) error {
	defer c.epochs.Bump(authz.CredentialKey(id))
	return c.Manager.Revoke(ctx, id)
}

func (c *Cached) RevokeService(ctx context.Context, id string) error {
	defer c.epochs.Bump(authz.CredentialKey(id))
	return c.Manager.RevokeService(ctx, id)
}
