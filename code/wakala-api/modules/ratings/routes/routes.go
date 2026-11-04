package routes

import (
	"fmt"
	"sync"

	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/httpwire"

	ratings "wakalaserver/modules/ratings"
)

type Route = httpwire.Route

var operations = sync.OnceValues(func() (*dispatch.Spec, error) {
	return dispatch.Parse(ratings.Operations())
})

var sentinels = map[string]error{
	"ErrRatingNotFound":    ratings.ErrRatingNotFound,
	"ErrSettingNotFound":   ratings.ErrSettingNotFound,
	"ErrInvalidRating":     ratings.ErrInvalidRating,
	"ErrInvalidSimilarity": ratings.ErrInvalidSimilarity,
	"ErrInvalidSetting":    ratings.ErrInvalidSetting,
}

var AnonymousActions = []string{}

type Mount struct {
	Authorize dispatch.Authorizer
	Caller    dispatch.Caller
}

func Spec() (*dispatch.Spec, error) { return operations() }

func BuildFor(rm ratings.RatingsManager, m Mount) ([]Route, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	return dispatch.Dispatch(s, dispatch.Deps{
		Manager: rm, Errors: sentinels, Authorize: m.Authorize, Caller: m.Caller,
	})
}

func RoutesFor(rm ratings.RatingsManager, m Mount) []Route {
	out, err := BuildFor(rm, m)
	if err != nil {
		panic(fmt.Sprintf("ratings routes: %v", err))
	}
	return out
}

func Routes(rm ratings.RatingsManager) []Route { return RoutesFor(rm, Mount{}) }

func SplitFor(rm ratings.RatingsManager, m Mount) dispatch.Split {
	all := RoutesFor(rm, m)
	split := dispatch.Anonymous(all, AnonymousActions...)
	if missing := split.Unmatched(all, AnonymousActions); len(missing) > 0 {
		panic(fmt.Sprintf("ratings routes: unknown anonymous action(s): %v", missing))
	}
	return split
}

func OperatorRoutesFor(rm ratings.RatingsManager, m Mount) []Route {
	return SplitFor(rm, m).Gated
}
