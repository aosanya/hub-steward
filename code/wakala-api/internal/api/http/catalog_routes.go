package http

import (
	"net/http"

	catalog "wakalaserver/modules/catalog"
	catalogroutes "wakalaserver/modules/catalog/routes"

	"wakalaserver/internal/accounts"
)

const catalogPrefix = "/catalog"

func (d *Deps) registerCatalogRoutes(mux *http.ServeMux, auth callers) {
	cm := d.Catalog
	if cm == nil {
		return
	}
	for _, rt := range anonymousCatalogRoutes(cm) {
		mux.HandleFunc(rt.Pattern(catalogPrefix), rt.Handler)
	}
	for _, rt := range catalogroutes.OperatorRoutesFor(cm, d.catalogMount()) {
		mux.HandleFunc(rt.Pattern(catalogPrefix), auth.require(rt.Handler))
	}
}

func (d *Deps) catalogMount() catalogroutes.Mount {
	return catalogroutes.Mount{
		Authorize: d.failClosedAuthorizer(catalogScope),
		Caller:    accounts.IDFromContext,
	}
}

func anonymousCatalogRoutes(cm catalog.CatalogManager) []catalogroutes.Route {
	return catalogroutes.PublicRoutes(cm)
}
