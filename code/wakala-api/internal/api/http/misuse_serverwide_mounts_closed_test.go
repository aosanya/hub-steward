package http

import (
	"context"
	"errors"
	"testing"

	"wakalaserver/modules/shared/dispatch"
)

func TestServerWideMounts_RefuseEveryActionWhenNoPermissionsModuleIsMounted(t *testing.T) {
	d := &Deps{}
	authorizers := map[string]dispatch.Authorizer{
		"reports": d.reportsMount().Authorize,
		"catalog": d.catalogMount().Authorize,
		"ratings": d.ratingsMount().Authorize,
		"forms":   d.serverFormsMount().Authorize,
	}
	for name, authorize := range authorizers {
		if authorize == nil {
			t.Errorf("%s mount has no authorizer without a permissions module, so it admits every caller", name)
			continue
		}
		if err := authorize(context.Background(), "catalog.entry.upsert"); !errors.Is(err, dispatch.ErrForbidden) {
			t.Errorf("%s mount without a permissions module: got %v, want forbidden", name, err)
		}
	}
}
