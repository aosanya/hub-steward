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

func Build(wm workspace.WorkspaceManager) ([]Route, error) { return BuildWith(wm, nil) }

func BuildWith(wm workspace.WorkspaceManager, authorize dispatch.Authorizer) ([]Route, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	return dispatch.Dispatch(s, dispatch.Deps{Manager: wm, Errors: sentinels, Authorize: authorize})
}

func Routes(wm workspace.WorkspaceManager) []Route { return RoutesWith(wm, nil) }

func RoutesWith(wm workspace.WorkspaceManager, authorize dispatch.Authorizer) []Route {
	out, err := BuildWith(wm, authorize)
	if err != nil {
		panic(fmt.Sprintf("workspace routes: %v", err))
	}
	return out
}

func Split(wm workspace.WorkspaceManager) dispatch.Split { return SplitWith(wm, nil) }

func SplitWith(wm workspace.WorkspaceManager, authorize dispatch.Authorizer) dispatch.Split {
	public := dispatch.Anonymous(Routes(wm), AnonymousActions...)
	gated := dispatch.Anonymous(RoutesWith(wm, authorize), AnonymousActions...)
	return dispatch.Split{Anonymous: public.Anonymous, Gated: gated.Gated}
}

func PublicRoutes(wm workspace.WorkspaceManager) []Route { return Split(wm).Anonymous }

func OwnerRoutes(wm workspace.WorkspaceManager) []Route { return OwnerRoutesWith(wm, nil) }

func OwnerRoutesWith(wm workspace.WorkspaceManager, authorize dispatch.Authorizer) []Route {
	return SplitWith(wm, authorize).Gated
}
