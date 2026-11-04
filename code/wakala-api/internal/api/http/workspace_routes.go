package http

import (
	"net/http"

	workspaceroutes "wakalaserver/modules/workspace/routes"
)

const workspacePrefix = "/workspace"

const workspaceScope = "module:workspace"

func (d *Deps) registerWorkspaceRoutes(mux *http.ServeMux, auth callers) {
	wm := d.Workspace
	if wm == nil {
		return
	}
	for _, rt := range workspaceroutes.PublicRoutes(wm) {
		mux.HandleFunc(rt.Pattern(workspacePrefix), rt.Handler)
	}
	for _, rt := range workspaceroutes.OwnerRoutesWith(wm, d.authorizer(workspaceScope)) {
		mux.HandleFunc(rt.Pattern(workspacePrefix), auth.require(rt.Handler))
	}
	if d.Layouts == nil {
		return
	}
	for _, rt := range workspaceroutes.LayoutRoutesWith(d.Layouts, d.authorizer(workspaceScope)) {
		mux.HandleFunc(rt.Pattern(workspacePrefix), auth.require(rt.Handler))
	}
}
