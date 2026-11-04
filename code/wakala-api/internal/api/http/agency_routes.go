package http

import (
	"net/http"

	agencyroutes "wakalaserver/modules/agency/routes"

	"wakalaserver/internal/agencies"
)

// agencyInstancePrefix is where every mwanachama-backend-agency route is
// mounted, scoped to one registered Instance (decision #15) — e.g.
// "/instances/{instanceID}/agency", ".../goals", ".../goals/{goalID}".
const agencyInstancePrefix = "/instances/{instanceID}"

// registerAgencyRoutes mounts every address agency declares, scoped per
// Instance and requireCaller-gated (decision #4, WK8). Unlike
// mwanachama-backend-api-gateway's own mount (a single fixed AgencyManager
// passed once at boot), this repo holds many Agencies, so which manager
// answers a request is decided per request, off the URL's {instanceID} —
// agencyroutes.Shape() reads the declared Method/Path/Action without a
// manager, and the handlers are built fresh per request against the real
// one, in the same declared order.
func registerAgencyRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	shape := agencyroutes.Shape()
	for i, rt := range shape {
		idx := i
		mux.HandleFunc(rt.Pattern(agencyInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			m, err := agencyManagerFor(r.Context(), reg, r.PathValue("instanceID"))
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			agencyroutes.Routes(m)[idx].Handler(w, r)
		}))
	}
}
