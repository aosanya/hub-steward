package http

import (
	"net/http"

	agencyroutes "wakalaserver/modules/agency/routes"

	"wakalaserver/internal/agencies"
)

const agencyInstancePrefix = "/instances/{instanceID}"

func (d *Deps) registerAgencyRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	shape := agencyroutes.Shape()
	for i, rt := range shape {
		idx := i
		action := rt.Action
		mux.HandleFunc(rt.Pattern(agencyInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			instanceID := r.PathValue("instanceID")
			m, err := agencyManagerFor(r.Context(), reg, instanceID)
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			r = withPartition(r, instanceID)
			if !d.agentMayDesign(r, instanceID, action) {
				writeErr(w, http.StatusForbidden, "forbidden")
				return
			}
			agencyroutes.Routes(m)[idx].Handler(w, r)
		}))
	}
}

func (d *Deps) agentMayDesign(r *http.Request, instanceID, action string) bool {
	if r.Method == http.MethodGet || r.Method == http.MethodHead {
		return true
	}
	role := d.callerRole(r, instanceID)
	if role != agencies.RoleAgent {
		return true
	}
	gate := agentPermissioned(role, d.Registry, d.agencyRolePermissions, nil)
	return gate(r.Context(), action) == nil
}
