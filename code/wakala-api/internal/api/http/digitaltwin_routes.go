package http

import (
	"net/http"

	twinroutes "wakalaserver/modules/digitaltwin/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const digitaltwinInstancePrefix = "/instances/{instanceID}/digitaltwin"

func digitaltwinMount() twinroutes.Mount {
	return twinroutes.Mount{Caller: accounts.IDFromContext}
}

func (d *Deps) instanceDigitaltwinMount(role string) twinroutes.Mount {
	mount := digitaltwinMount()
	mount.Authorize = agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize)
	return mount
}

func (d *Deps) registerDigitaltwinRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	shape, err := twinroutes.Table.Shape()
	if err != nil {
		panic(err)
	}
	for i, rt := range shape {
		idx := i
		mux.HandleFunc(rt.Pattern(digitaltwinInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			m, err := twinManagerFor(r.Context(), reg, r.PathValue("instanceID"))
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			instanceID := r.PathValue("instanceID")
			r = withPartition(r, instanceID)
			twinroutes.RoutesFor(m, d.instanceDigitaltwinMount(d.callerRole(r, instanceID)))[idx].Handler(w, r)
		}))
	}
}
