package http

import (
	"net/http"

	catalog "wakalaserver/modules/catalog"
	catalogroutes "wakalaserver/modules/catalog/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const catalogPrefix = "/catalog"

func (d *Deps) registerCatalogRoutes(mux *http.ServeMux, auth callers) {
	cm := d.Catalog
	if cm == nil {
		return
	}
	if d.Registry != nil {
		d.registerAgencyCatalogRoutes(mux, auth)
		return
	}
	for _, rt := range anonymousCatalogRoutes(cm) {
		mux.HandleFunc(rt.Pattern(catalogPrefix), rt.Handler)
	}
	for _, rt := range catalogroutes.OperatorRoutesFor(cm, d.catalogMount()) {
		mux.HandleFunc(rt.Pattern(catalogPrefix), auth.require(rt.Handler))
	}
}

func (d *Deps) registerAgencyCatalogRoutes(mux *http.ServeMux, auth callers) {
	public := agencyCatalogRoutes{deps: d, mount: agencies.MountCatalog, public: true, build: anonymousCatalogRoutes}
	for i, rt := range anonymousCatalogRoutes(formsCatalogShape{}) {
		mux.HandleFunc(rt.Pattern(catalogPrefix), public.handler(i))
	}
	m := d.catalogMount()
	operator := agencyCatalogRoutes{deps: d, mount: agencies.MountCatalog, build: func(cm catalog.CatalogManager) []catalogroutes.Route {
		return catalogroutes.OperatorRoutesFor(cm, m)
	}}
	for i, rt := range catalogroutes.OperatorRoutesFor(formsCatalogShape{}, m) {
		mux.HandleFunc(rt.Pattern(catalogPrefix), auth.require(operator.handler(i)))
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
