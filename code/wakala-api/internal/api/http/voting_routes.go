package http

import (
	"net/http"

	votingroutes "wakalaserver/modules/voting/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const votingInstancePrefix = "/instances/{instanceID}/voting"

func votingMount() votingroutes.Mount {
	return votingroutes.Mount{Caller: accounts.IDFromContext}
}

func (d *Deps) instanceVotingMount(role string) votingroutes.Mount {
	mount := votingMount()
	if role == agencies.RoleResident {
		mount.Authorize = authorizeResidentVoting
	}
	mount.Authorize = agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize)
	return mount
}

func (d *Deps) registerVotingRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	shape, err := votingroutes.Table.Shape()
	if err != nil {
		panic(err)
	}
	for i, rt := range shape {
		idx := i
		mux.HandleFunc(rt.Pattern(votingInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			m, err := pollManagerFor(r.Context(), reg, r.PathValue("instanceID"))
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			instanceID := r.PathValue("instanceID")
			r = withPartition(r, instanceID)
			role := d.callerRole(r, instanceID)
			if role == agencies.RoleResident {
				m = residentPolls{m}
			}
			votingroutes.RoutesFor(m, d.instanceVotingMount(role))[idx].Handler(w, r)
		}))
	}
}
