package routes

import (
	"fmt"
	"sync"

	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/httpwire"

	insights "wakalaserver/modules/insights"
)

type Route = httpwire.Route

var operations = sync.OnceValues(func() (*dispatch.Spec, error) {
	return dispatch.Parse(insights.Operations())
})

var sentinels = map[string]error{
	"ErrInsightNotFound":    insights.ErrInsightNotFound,
	"ErrInvalidInsight":     insights.ErrInvalidInsight,
	"ErrInvalidInsightNote": insights.ErrInvalidInsightNote,
}

var AnonymousActions []string

type Mount struct {
	Authorize dispatch.Authorizer
	Caller    dispatch.Caller
}

func Build(im insights.InsightManager) ([]Route, error) { return BuildFor(im, Mount{}) }

func BuildFor(im insights.InsightManager, m Mount) ([]Route, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	return dispatch.Dispatch(s, dispatch.Deps{
		Manager: im, Errors: sentinels, Authorize: m.Authorize, Caller: m.Caller,
	})
}

func Routes(im insights.InsightManager) []Route { return RoutesFor(im, Mount{}) }

func RoutesFor(im insights.InsightManager, m Mount) []Route {
	out, err := BuildFor(im, m)
	if err != nil {
		panic(fmt.Sprintf("insights routes: %v", err))
	}
	return out
}

func Shape() []Route {
	s, err := operations()
	if err != nil {
		panic(fmt.Sprintf("insights routes: %v", err))
	}
	return dispatch.Shape(s)
}
