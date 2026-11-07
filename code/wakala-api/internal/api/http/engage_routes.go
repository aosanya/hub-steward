package http

import (
	"net/http"

	engageroutes "wakalaserver/modules/engage/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const engageInstancePrefix = "/instances/{instanceID}/engage"

func engageMount() engageroutes.Mount {
	return engageroutes.Mount{Caller: accounts.IDFromContext}
}

func (d *Deps) instanceEngageMount(role string) engageroutes.Mount {
	mount := engageMount()
	mount.Authorize = agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize)
	return mount
}

func (d *Deps) registerEngageRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	shape, err := engageroutes.Table.Shape()
	if err != nil {
		panic(err)
	}
	for i, rt := range shape {
		idx := i
		mux.HandleFunc(rt.Pattern(engageInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			instanceID := r.PathValue("instanceID")
			m, err := postManagerFor(r.Context(), reg, instanceID)
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			r = withPartition(r, instanceID)
			engageroutes.RoutesFor(m, d.instanceEngageMount(d.callerRole(r, instanceID)))[idx].Handler(w, r)
		}))
	}
}
