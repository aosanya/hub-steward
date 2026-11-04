package http

import (
	"net/http"

	sourcesroutes "wakalaserver/modules/sources/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const sourcesInstancePrefix = "/instances/{instanceID}/sources"

func sourcesMount() sourcesroutes.Mount {
	return sourcesroutes.Mount{Caller: accounts.IDFromContext}
}

func (d *Deps) instanceSourcesMount(role string) sourcesroutes.Mount {
	mount := sourcesMount()
	mount.Authorize = agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize)
	return mount
}

func (d *Deps) registerSourcesRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	shape, err := sourcesroutes.Table.Shape()
	if err != nil {
		panic(err)
	}
	for i, rt := range shape {
		idx, action := i, rt.Action
		mux.HandleFunc(rt.Pattern(sourcesInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			m, err := sourceManagerFor(r.Context(), reg, r.PathValue("instanceID"))
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			instanceID := r.PathValue("instanceID")
			role, err := reg.RoleOf(r.Context(), instanceID, accounts.IDFromContext(r.Context()))
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			r = withPartition(r, instanceID)
			mount := d.instanceSourcesMount(role)
			if refusedAsMissing(w, r, mount.Authorize, action) {
				return
			}
			mount.Authorize = nil
			sourcesroutes.RoutesFor(m, mount)[idx].Handler(w, r)
		}))
	}
}
