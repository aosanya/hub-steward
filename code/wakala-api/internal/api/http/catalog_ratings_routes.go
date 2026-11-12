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
	if d.Registry != nil {
		d.registerAgencyRatingsRoutes(mux, auth)
		return
	}
	for _, rt := range ratingsroutes.OperatorRoutesFor(d.Ratings, d.ratingsMount()) {
		mux.HandleFunc(rt.Pattern(catalogPrefix), auth.require(rt.Handler))
	}
}

func (d *Deps) registerAgencyRatingsRoutes(mux *http.ServeMux, auth callers) {
	operator := agencyRatingsRoutes{deps: d, mount: d.ratingsMount()}
	for i, rt := range operator.build(d.Ratings) {
		mux.HandleFunc(rt.Pattern(catalogPrefix), auth.require(operator.handler(i)))
	}
}

func (d *Deps) ratingsMount() ratingsroutes.Mount {
	return ratingsroutes.Mount{
		Authorize: d.failClosedAuthorizer(catalogScope),
		Caller:    accounts.IDFromContext,
	}
}
