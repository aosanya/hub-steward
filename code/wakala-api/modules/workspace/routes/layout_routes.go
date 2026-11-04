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
	s, err := layoutOperations()
	if err != nil {
		return nil, err
	}
	return dispatch.Dispatch(s, dispatch.Deps{Manager: lm, Errors: layoutSentinels, Authorize: authorize})
}

func LayoutRoutes(lm workspace.LayoutManager) []Route { return LayoutRoutesWith(lm, nil) }

func LayoutRoutesWith(lm workspace.LayoutManager, authorize dispatch.Authorizer) []Route {
	out, err := BuildLayoutRoutes(lm, authorize)
	if err != nil {
		panic(fmt.Sprintf("workspace layout routes: %v", err))
	}
	return out
}

func BuildLayoutTools(lm workspace.LayoutManager, authorize dispatch.Authorizer) ([]Tool, error) {
	s, err := layoutOperations()
	if err != nil {
		return nil, err
	}
	fields, err := Fields()
	if err != nil {
		return nil, err
	}
	return dispatch.Tools(s, dispatch.Deps{
		Manager: lm, Errors: layoutSentinels, Fields: fields, Authorize: authorize,
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
