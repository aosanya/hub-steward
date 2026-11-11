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

type agencyOwnerKey struct{}

func AsAgencyOwner(ctx context.Context) context.Context {
	return context.WithValue(ctx, agencyOwnerKey{}, true)
}

func isAgencyOwner(ctx context.Context) bool {
	owner, _ := ctx.Value(agencyOwnerKey{}).(bool)
	return owner
}

func entryMayBeChangedBy(ctx context.Context, existing Entry, caller string) error {
	if caller == "" || existing.SubmittedBy == "" || existing.SubmittedBy == caller || isAgencyOwner(ctx) {
		return nil
	}
	return ErrNotEntryOwner
}
