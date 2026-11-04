package http

import (
	"net/http"

	catalogroutes "wakalaserver/modules/catalog/routes"

	"wakalaserver/internal/accounts"
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

func (d *Deps) reportsMount() catalogroutes.Mount {
	return catalogroutes.Mount{
		Authorize: d.authorizer(reportsScope),
		Caller:    accounts.IDFromContext,
		Anonymous: reportsAnonymousActions,
	}
}
