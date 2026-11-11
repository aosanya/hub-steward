package routes

import (
	"fmt"
	"sync"

	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/httpwire"

	workspace "wakalaserver/modules/workspace"
)

type Route = httpwire.Route

var operations = sync.OnceValues(func() (*dispatch.Spec, error) {
	return dispatch.Parse(workspace.Operations())
})

var sentinels = map[string]error{
	"ErrInvalidWorkbook":   workspace.ErrInvalidWorkbook,
	"ErrWorkbookNotFound":  workspace.ErrWorkbookNotFound,
	"ErrInvalidReference":  workspace.ErrInvalidReference,
	"ErrReferenceNotFound": workspace.ErrReferenceNotFound,
	"ErrInvalidUse":        workspace.ErrInvalidUse,
	"ErrInvalidAction":     workspace.ErrInvalidAction,
	"ErrInvalidShare":      workspace.ErrInvalidShare,
	"ErrShareNotFound":     workspace.ErrShareNotFound,
	"ErrShareRetired":      workspace.ErrShareRetired,
}

var AnonymousActions = []string{
	"workspace.workbook.open",
}

type Mount = dispatch.Mount

func Build(wm workspace.WorkspaceManager) ([]Route, error) { return BuildFor(wm, Mount{}) }

func BuildWith(wm workspace.WorkspaceManager, authorize dispatch.Authorizer) ([]Route, error) {
	return BuildFor(wm, Mount{Authorize: authorize})
}

func BuildFor(wm workspace.WorkspaceManager, m Mount) ([]Route, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	return dispatch.Dispatch(s, dispatch.Deps{Manager: wm, Errors: sentinels, Authorize: m.Authorize, Caller: m.Caller, Device: m.Device})
}

func Routes(wm workspace.WorkspaceManager) []Route { return RoutesFor(wm, Mount{}) }

func RoutesWith(wm workspace.WorkspaceManager, authorize dispatch.Authorizer) []Route {
	return RoutesFor(wm, Mount{Authorize: authorize})
}

func RoutesFor(wm workspace.WorkspaceManager, m Mount) []Route {
	out, err := BuildFor(wm, m)
	if err != nil {
		panic(fmt.Sprintf("workspace routes: %v", err))
	}
	return out
}

func Split(wm workspace.WorkspaceManager) dispatch.Split { return SplitFor(wm, Mount{}) }

func SplitWith(wm workspace.WorkspaceManager, authorize dispatch.Authorizer) dispatch.Split {
	return SplitFor(wm, Mount{Authorize: authorize})
}

func SplitFor(wm workspace.WorkspaceManager, m Mount) dispatch.Split {
	public := dispatch.Anonymous(RoutesFor(wm, Mount{Caller: m.Caller, Device: m.Device}), AnonymousActions...)
	gated := dispatch.Anonymous(RoutesFor(wm, m), AnonymousActions...)
	return dispatch.Split{Anonymous: public.Anonymous, Gated: gated.Gated}
}

func PublicRoutes(wm workspace.WorkspaceManager) []Route { return Split(wm).Anonymous }

func OwnerRoutes(wm workspace.WorkspaceManager) []Route { return OwnerRoutesFor(wm, Mount{}) }

func OwnerRoutesWith(wm workspace.WorkspaceManager, authorize dispatch.Authorizer) []Route {
	return OwnerRoutesFor(wm, Mount{Authorize: authorize})
}

func OwnerRoutesFor(wm workspace.WorkspaceManager, m Mount) []Route {
	return SplitFor(wm, m).Gated
}
