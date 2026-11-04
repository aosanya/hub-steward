package http

import (
	"net/http"

	actorroutes "wakalaserver/modules/actor/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const actorInstancePrefix = "/instances/{instanceID}/actor"

const actorScope = "module:actor"

var actorActionsClosedToCallers = map[string]bool{"actor.assignment.delete": true}

func (d *Deps) registerActorRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	shape := actorroutes.Shape()
	for i, rt := range shape {
		idx, action := i, rt.Action
		if actorActionsClosedToCallers[action] {
			mux.HandleFunc(rt.Pattern(actorInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
				writeInstanceErr(w, agencies.ErrInstanceNotFound)
			}))
			continue
		}
		mux.HandleFunc(rt.Pattern(actorInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			instanceID := r.PathValue("instanceID")
			m, role, err := actorManagerFor(r.Context(), reg, instanceID)
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			r = withPartition(r, instanceID)
			mount := d.actorMount(role)
			if refusedAsMissing(w, r, mount.Authorize, action) {
				return
			}
			mount.Authorize = nil
			if role == agencies.RoleResident {
				if err := residentLeadsTheGroupNamed(r, m, action); err != nil {
					writeLeaderRefusal(w, err)
					return
				}
			}
			announced := withheldFromMembers(quietDeclinesUnseen{joinDecisionsAnnounced{UserManager: m, rooms: reg, instanceID: instanceID, rules: d.NotifyRules, agency: reg}}, action)
			withMemberSearch(action, withInvitedGroupNames(reg, action, withScreenNames(reg, action, actorroutes.RoutesFor(announced, mount)[idx].Handler)))(w, r)
		}))
	}
}

func checkedActorMount() actorroutes.Mount {
	return actorroutes.Mount{CheckReferences: true, Caller: accounts.IDFromContext}
}

func (d *Deps) actorMount(role string) actorroutes.Mount {
	mount := checkedActorMount()
	if role == agencies.RoleResident {
		mount.Authorize = d.authorizeResident(actorScope)
	}
	mount.Authorize = operatorOnlyActor(role, ownerOnlyActor(role, mount.Authorize))
	mount.Authorize = agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize)
	return mount
}
