package http

import (
	"net/http"

	commroutes "wakalaserver/modules/comm/routes"
	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const commInstancePrefix = "/instances/{instanceID}/comm"

func (d *Deps) registerInstanceCommRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	if reg == nil {
		return
	}
	for i, rt := range commGatedShape() {
		idx, action := i, rt.Action
		mux.HandleFunc(rt.Pattern(commInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			cm, role, err := commManagerFor(r.Context(), reg, r.PathValue("instanceID"), action)
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			mount := d.instanceCommMount(role)
			r = withPartition(r, r.PathValue("instanceID"))
			if refusedAsMissing(w, r, mount.Authorize, action) {
				return
			}
			mount.Authorize = nil
			if err := openGeneralOnRead(r, reg, mount, action); err != nil {
				writeInstanceErr(w, err)
				return
			}
			withGeneralStandingThread(reg, action, withInvitedGroupNames(reg, action, withScreenNames(reg, action, withAuthorRoles(reg, action, commroutes.OperatorRoutes(cm, mount)[idx].Handler))))(w, r)
		}))
	}
}

func commGatedShape() []commroutes.Route {
	shape, err := commroutes.Shape()
	if err != nil {
		panic("comm operations: " + err.Error())
	}
	return dispatch.Anonymous(shape, commroutes.AnonymousActions...).Gated
}

func (d *Deps) commMount() commroutes.Mount {
	return commroutes.Mount{
		Authorize: d.authorizer(commScope),
		Caller:    accounts.IDFromContext,
	}
}

const commListThreadsAction = "comm.chat_thread.list"

func openGeneralOnRead(r *http.Request, reg agencies.Registry, mount commroutes.Mount, action string) error {
	if action != commListThreadsAction {
		return nil
	}
	if mount.Authorize != nil && mount.Authorize(r.Context(), action) != nil {
		return nil
	}
	return reg.OpenGeneralThread(r.Context(), r.PathValue("instanceID"), r.PathValue("structure_id"), accounts.IDFromContext(r.Context()))
}
