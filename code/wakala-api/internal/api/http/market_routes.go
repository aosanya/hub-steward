package http

import (
	"net/http"

	marketroutes "wakalaserver/modules/market/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const marketInstancePrefix = "/instances/{instanceID}/market"

func marketMount() marketroutes.Mount {
	return marketroutes.Mount{Caller: accounts.IDFromContext}
}

func (d *Deps) instanceMarketMount(role string) marketroutes.Mount {
	mount := marketMount()
	mount.Authorize = coordinatorGated(role, agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize))
	return mount
}

func (d *Deps) registerMarketRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	shape, err := marketroutes.Table.Shape()
	if err != nil {
		panic(err)
	}
	named := http.NewServeMux()
	for i, rt := range shape {
		idx := i
		handler := auth.require(func(w http.ResponseWriter, r *http.Request) {
			instanceID := r.PathValue("instanceID")
			m, err := marketManagerNamed(r.Context(), reg, instanceID, r.PathValue("marketName"))
			if err != nil {
				writeMarketErr(w, err)
				return
			}
			r = withPartition(r, instanceID)
			m = d.marketAnnounced(m, instanceID)
			marketroutes.RoutesFor(m, d.instanceMarketMount(d.callerRole(r, instanceID)))[idx].Handler(w, r)
		})
		mux.HandleFunc(rt.Pattern(marketInstancePrefix), handler)
		named.HandleFunc(rt.Pattern(marketInstancePrefix+"/{marketName}"), handler)
	}
	mux.Handle(marketInstancePrefix+"/{rest...}", named)
}
