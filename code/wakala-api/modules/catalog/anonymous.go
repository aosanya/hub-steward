package mwanachamacatalog

import "context"

type anonymousKey struct{}

func AsAnonymous(ctx context.Context) context.Context {
	return context.WithValue(ctx, anonymousKey{}, true)
}

func isAnonymous(ctx context.Context) bool {
	anonymous, _ := ctx.Value(anonymousKey{}).(bool)
	return anonymous
}
