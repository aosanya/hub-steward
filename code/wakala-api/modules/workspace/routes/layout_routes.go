package routes

import (
	"fmt"
	"sync"

	"wakalaserver/modules/shared/dispatch"

	workspace "wakalaserver/modules/workspace"
)

var layoutOperations = sync.OnceValues(func() (*dispatch.Spec, error) {
	return dispatch.Parse(workspace.LayoutOperations())
})

var layoutSentinels = map[string]error{
	"ErrInvalidLayout":        workspace.ErrInvalidLayout,
	"ErrLayoutNotFound":       workspace.ErrLayoutNotFound,
	"ErrLayoutMoved":          workspace.ErrLayoutMoved,
	"ErrLayoutPublished":      workspace.ErrLayoutPublished,
	"ErrLayoutNotWhole":       workspace.ErrLayoutNotWhole,
	"ErrLayoutNotAPatch":      workspace.ErrLayoutNotAPatch,
	"ErrInvalidPatch":         workspace.ErrInvalidPatch,
	"ErrInvalidPointer":       workspace.ErrInvalidPointer,
	"ErrLayoutChangeNotFound": workspace.ErrLayoutChangeNotFound,
	"ErrLayoutChangeReverted": workspace.ErrLayoutChangeReverted,
	"ErrInvalidCopy":          workspace.ErrInvalidCopy,
	"ErrInvalidChoice":        workspace.ErrInvalidChoice,
	"ErrChoiceNotFound":       workspace.ErrChoiceNotFound,
}

func BuildLayoutRoutes(lm workspace.LayoutManager, authorize dispatch.Authorizer) ([]Route, error) {
	return BuildLayoutRoutesFor(lm, Mount{Authorize: authorize})
}

func BuildLayoutRoutesFor(lm workspace.LayoutManager, m Mount) ([]Route, error) {
	s, err := layoutOperations()
	if err != nil {
		return nil, err
	}
	return dispatch.Dispatch(s, dispatch.Deps{Manager: lm, Errors: layoutSentinels, Authorize: m.Authorize, Caller: m.Caller, Device: m.Device})
}

func LayoutRoutes(lm workspace.LayoutManager) []Route { return LayoutRoutesWith(lm, nil) }

func LayoutRoutesWith(lm workspace.LayoutManager, authorize dispatch.Authorizer) []Route {
	return LayoutRoutesFor(lm, Mount{Authorize: authorize})
}

func LayoutRoutesFor(lm workspace.LayoutManager, m Mount) []Route {
	out, err := BuildLayoutRoutesFor(lm, m)
	if err != nil {
		panic(fmt.Sprintf("workspace layout routes: %v", err))
	}
	return out
}

func BuildLayoutTools(lm workspace.LayoutManager, authorize dispatch.Authorizer) ([]Tool, error) {
	return BuildLayoutToolsFor(lm, Mount{Authorize: authorize})
}

func BuildLayoutToolsFor(lm workspace.LayoutManager, m Mount) ([]Tool, error) {
	s, err := layoutOperations()
	if err != nil {
		return nil, err
	}
	fields, err := Fields()
	if err != nil {
		return nil, err
	}
	return dispatch.Tools(s, dispatch.Deps{
		Manager: lm, Errors: layoutSentinels, Fields: fields, Authorize: m.Authorize, Caller: m.Caller, Device: m.Device,
	})
}

func LayoutTools(lm workspace.LayoutManager) []Tool { return LayoutToolsWith(lm, nil) }

func LayoutToolsWith(lm workspace.LayoutManager, authorize dispatch.Authorizer) []Tool {
	out, err := BuildLayoutTools(lm, authorize)
	if err != nil {
		panic(fmt.Sprintf("workspace layout tools: %v", err))
	}
	return out
}
