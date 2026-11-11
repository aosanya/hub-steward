package http

import (
	"net/http"

	ratingsroutes "wakalaserver/modules/ratings/routes"

	"wakalaserver/internal/accounts"
)

func (d *Deps) registerCatalogRatingsRoutes(mux *http.ServeMux, auth callers) {
	if d.Ratings == nil {
		return
	}
	for _, rt := range ratingsroutes.OperatorRoutesFor(d.Ratings, d.ratingsMount()) {
		mux.HandleFunc(rt.Pattern(catalogPrefix), auth.require(rt.Handler))
	}
}

func (d *Deps) ratingsMount() ratingsroutes.Mount {
	return ratingsroutes.Mount{
		Authorize: d.failClosedAuthorizer(catalogScope),
		Caller:    accounts.IDFromContext,
	}
}
