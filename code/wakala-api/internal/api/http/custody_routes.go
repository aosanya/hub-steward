package http

import (
	"net/http"

	custodyroutes "wakalaserver/modules/custody/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const custodyInstancePrefix = "/instances/{instanceID}/custody"

func custodyMount() custodyroutes.Mount {
	return custodyroutes.Mount{Caller: accounts.IDFromContext}
}

func (d *Deps) instanceCustodyMount(role string) custodyroutes.Mount {
	mount := custodyMount()
	mount.Authorize = agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize)
	return mount
}

func (d *Deps) registerCustodyRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	shape, err := custodyroutes.Table.Shape()
	if err != nil {
		panic(err)
	}
	for i, rt := range shape {
		idx := i
		mux.HandleFunc(rt.Pattern(custodyInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			instanceID := r.PathValue("instanceID")
			m, err := custodyManagerFor(r.Context(), reg, instanceID)
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			r = withPartition(r, instanceID)
			custodyroutes.RoutesFor(m, d.instanceCustodyMount(d.callerRole(r, instanceID)))[idx].Handler(w, r)
		}))
	}
}
