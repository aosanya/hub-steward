package http

import (
	"net/http"

	"wakalaserver/internal/agencies"
)

const (
	setJoinModeAction = "instance.join_mode.set"
	renameAction      = "instance.instance.rename"
)

func (d *Deps) agentMayChangeInstanceSettings(action string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		r = withPartition(r, instanceID)
		role := d.callerRole(r, instanceID)
		if role == agencies.RoleAgent {
			gate := agentPermissioned(role, d.Registry, d.agencyRolePermissions, nil)
			if gate(r.Context(), action) != nil {
				writeErr(w, http.StatusForbidden, "forbidden")
				return
			}
		}
		next(w, r)
	}
}
