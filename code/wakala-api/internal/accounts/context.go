// Package accounts gives an account its own database (WK24): the connection
// is stored encrypted, only this API ever holds it, and a Router picks the
// registry for the calling account so every route and /mcp reach only that
// account's Agencies. An account with no stored connection keeps using the
// shared database.
package accounts

import "context"

type ctxKey struct{}

// WithID returns ctx carrying the calling account's id.
func WithID(ctx context.Context, accountID string) context.Context {
	return context.WithValue(ctx, ctxKey{}, accountID)
}

// IDFromContext returns the calling account's id, or "" when the caller has
// none (the shared database serves those).
func IDFromContext(ctx context.Context) string {
	id, _ := ctx.Value(ctxKey{}).(string)
	return id
}
