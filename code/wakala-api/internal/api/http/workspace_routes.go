package http

import (
	"net/http"

	workspaceroutes "wakalaserver/modules/workspace/routes"

	"wakalaserver/internal/accounts"
)

const workspacePrefix = "/workspace"

const workspaceScope = "module:workspace"

func (d *Deps) workspaceMount() workspaceroutes.Mount {
	return workspaceroutes.Mount{Authorize: d.authorizer(workspaceScope), Caller: accounts.IDFromContext}
}

func (d *Deps) registerWorkspaceRoutes(mux *http.ServeMux, auth callers) {
	wm := d.Workspace
	if wm == nil {
		return
	}
	for _, rt := range workspaceroutes.PublicRoutes(wm) {
		mux.HandleFunc(rt.Pattern(workspacePrefix), rt.Handler)
	}
	for _, rt := range workspaceroutes.OwnerRoutesFor(wm, d.workspaceMount()) {
		mux.HandleFunc(rt.Pattern(workspacePrefix), auth.require(rt.Handler))
	}
	if d.Layouts == nil {
		return
	}
	for _, rt := range workspaceroutes.LayoutRoutesFor(d.Layouts, d.workspaceMount()) {
		mux.HandleFunc(rt.Pattern(workspacePrefix), auth.require(rt.Handler))
	}
}
