package http

import (
	"net/http"

	mwanachamainsights "wakalaserver/modules/insights"
	insightsroutes "wakalaserver/modules/insights/routes"

	"wakalaserver/internal/agencies"
)

// registerInsightRoutes mounts mwanachama-backend-insights' own routes
// package at the root ("/insights", "/insights/{insightID}/notes"),
// requireCaller-gated like every other core API route. Unlike
// registerAgencyRoutes, there is no per-request manager resolution: d.Insights
// is a single fixed instance already sitting concrete on Deps (decision
// #17), so insightsroutes.Routes is called once, here, against the real
// manager.
func registerInsightRoutes(mux *http.ServeMux, im mwanachamainsights.InsightManager, reg agencies.Registry, auth callers) {
	if im == nil {
		return
	}
	for _, rt := range insightsroutes.Routes(im) {
		mux.HandleFunc(rt.Pattern(""), auth.require(scopeInsightsToMembership(reg, im, rt.Handler)))
	}
}
