package http

import (
	"context"
	"net/http"

	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
)

const (
	catalogScope = "module:catalog"
	reportsScope = "module:reports"
	formsScope   = "module:forms"
	commScope    = "module:comm"
	custodyScope = "module:custody"
)

func (d *Deps) authorizer(scope string) dispatch.Authorizer {
	if d.Permissions == nil {
		return nil
	}
	return func(ctx context.Context, action string) error {
		subject := accounts.IDFromContext(ctx)
		if subject == "" {
			return dispatch.ErrForbidden
		}
		ok, err := d.Permissions.MayPerformIn(ctx, subject, partitionOf(ctx), scope, action)
		if err != nil || !ok {
			return dispatch.ErrForbidden
		}
		return nil
	}
}

func (d *Deps) failClosedAuthorizer(scope string) dispatch.Authorizer {
	if d.Permissions == nil {
		return func(context.Context, string) error { return dispatch.ErrForbidden }
	}
	return d.authorizer(scope)
}

type partitionKey struct{}

func withPartition(r *http.Request, partition string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), partitionKey{}, partition))
}

func partitionOf(ctx context.Context) string {
	partition, _ := ctx.Value(partitionKey{}).(string)
	return partition
}
