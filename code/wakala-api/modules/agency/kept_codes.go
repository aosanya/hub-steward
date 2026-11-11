package mwanachamaagency

import (
	"context"

	"gorm.io/gorm"
)

type keptCodeKey struct{}

type reservedCodesKey struct{}

func WithKeptCode(ctx context.Context, code string) context.Context {
	return context.WithValue(ctx, keptCodeKey{}, code)
}

func WithReservedCodes(ctx context.Context, codes map[string]bool) context.Context {
	return context.WithValue(ctx, reservedCodesKey{}, codes)
}

func keptCodeFrom(ctx context.Context) string {
	code, _ := ctx.Value(keptCodeKey{}).(string)
	return code
}

func reservedCodesFrom(ctx context.Context) map[string]bool {
	codes, _ := ctx.Value(reservedCodesKey{}).(map[string]bool)
	return codes
}

func claimCode(ctx context.Context, tx *gorm.DB, table, entityType, prefix string) (string, error) {
	if kept := keptCodeFrom(ctx); kept != "" {
		if n := numberIn(kept, prefix); n > 0 {
			if err := raiseSequence(ctx, tx, table, entityType, n+1); err != nil {
				return "", err
			}
		}
		return kept, nil
	}
	reserved := reservedCodesFrom(ctx)
	for {
		code, err := nextCode(ctx, tx, table, entityType, prefix)
		if err != nil || !reserved[code] {
			return code, err
		}
	}
}
