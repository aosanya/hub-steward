package http

import (
	"net/http"

	catalog "wakalaserver/modules/catalog"
	catalogroutes "wakalaserver/modules/catalog/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const reportsPrefix = "/reports"

const reportFilingAction = "catalog.suggestion.file"

var reportsAnonymousActions = []string{
	"catalog.entry.open",
	"catalog.page_view.record",
	"catalog.suggestion.file",
	"catalog.entry.list_public",
}

func (d *Deps) registerReportsRoutes(mux *http.ServeMux, auth callers) {
	cm := d.Reports
	if cm == nil {
		return
	}
	m := d.reportsMount()
	if d.Registry != nil {
		d.registerAgencyReportsRoutes(mux, auth, m)
		return
	}
	filing := newAnonymousDoor(anonymousReportsPerMinute, anonymousReportBodyBytes)
	for _, rt := range catalogroutes.PublicRoutesFor(cm, m) {
		handler := rt.Handler
		if rt.Action == reportFilingAction {
			handler = filing.guard(handler)
		}
		mux.HandleFunc(rt.Pattern(reportsPrefix), handler)
	}
	for _, rt := range catalogroutes.OperatorRoutesFor(cm, m) {
		mux.HandleFunc(rt.Pattern(reportsPrefix), auth.require(rt.Handler))
	}
}

func (d *Deps) registerAgencyReportsRoutes(mux *http.ServeMux, auth callers, m catalogroutes.Mount) {
	filing := newAnonymousDoor(anonymousReportsPerMinute, anonymousReportBodyBytes)
	public := agencyCatalogRoutes{deps: d, mount: agencies.MountReports, public: true, build: func(cm catalog.CatalogManager) []catalogroutes.Route {
		return catalogroutes.PublicRoutesFor(cm, m)
	}}
	for i, rt := range catalogroutes.PublicRoutesFor(formsCatalogShape{}, m) {
		handler := public.handler(i)
		if rt.Action == reportFilingAction {
			handler = filing.guard(handler)
		}
		mux.HandleFunc(rt.Pattern(reportsPrefix), handler)
	}
	operator := agencyCatalogRoutes{deps: d, mount: agencies.MountReports, build: func(cm catalog.CatalogManager) []catalogroutes.Route {
		return catalogroutes.OperatorRoutesFor(cm, m)
	}}
	for i, rt := range catalogroutes.OperatorRoutesFor(formsCatalogShape{}, m) {
		mux.HandleFunc(rt.Pattern(reportsPrefix), auth.require(operator.handler(i)))
	}
}

func (d *Deps) reportsMount() catalogroutes.Mount {
	return catalogroutes.Mount{
		Authorize: d.failClosedAuthorizer(reportsScope),
		Caller:    accounts.IDFromContext,
		Anonymous: reportsAnonymousActions,
	}
}
