package http

import (
	"net/http"

	assetroutes "wakalaserver/modules/assetmanager/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const assetManagerInstancePrefix = "/instances/{instanceID}/assetmanager"

func assetManagerMount() assetroutes.Mount {
	return assetroutes.Mount{Caller: accounts.IDFromContext}
}

func (d *Deps) instanceAssetManagerMount(role string) assetroutes.Mount {
	mount := assetManagerMount()
	mount.Authorize = agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize)
	return mount
}

func (d *Deps) registerAssetManagerRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	shape, err := assetroutes.Table().Shape()
	if err != nil {
		panic(err)
	}
	for i, rt := range shape {
		idx := i
		mux.HandleFunc(rt.Pattern(assetManagerInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			m, err := assetManagerFor(r.Context(), reg, r.PathValue("instanceID"))
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			instanceID := r.PathValue("instanceID")
			r = withPartition(r, instanceID)
			assetroutes.RoutesFor(m, d.instanceAssetManagerMount(d.callerRole(r, instanceID)))[idx].Handler(w, r)
		}))
	}
}
