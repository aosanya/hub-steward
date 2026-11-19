package routes

import (
	"fmt"
	"sync"

	"github.com/aosanya/mwanachama-backend-shared/dispatch"
	"github.com/aosanya/mwanachama-backend-shared/httpwire"
	"github.com/aosanya/mwanachama-backend-shared/versioncheck"

	council "wakalaserver/modules/council"
)

type Route = httpwire.Route

var operations = sync.OnceValues(func() (*dispatch.Spec, error) {
	return dispatch.Parse(council.Operations())
})

var sentinels = map[string]error{
	"ErrInvalidBylaw":       council.ErrInvalidBylaw,
	"ErrBylawNotFound":      council.ErrBylawNotFound,
	"ErrInvalidResolution":  council.ErrInvalidResolution,
	"ErrResolutionNotFound": council.ErrResolutionNotFound,
	"ErrInvalidAgenda":      council.ErrInvalidAgenda,
	"ErrAgendaNotFound":     council.ErrAgendaNotFound,
	"ErrInvalidMinutes":     council.ErrInvalidMinutes,
	"ErrMinutesNotFound":    council.ErrMinutesNotFound,
	"ErrInvalidMeeting":     council.ErrInvalidMeeting,
	"ErrMeetingNotFound":    council.ErrMeetingNotFound,
	"ErrStale":              dispatch.ByType(&versioncheck.StaleError{}, nil),
}

var AnonymousActions []string

type Mount struct {
	Authorize dispatch.Authorizer
	Caller    dispatch.Caller
}

func Build(am council.CouncilManager) ([]Route, error) { return BuildFor(am, Mount{}) }

func BuildFor(am council.CouncilManager, m Mount) ([]Route, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	return dispatch.Dispatch(s, dispatch.Deps{
		Manager: am, Errors: sentinels, Authorize: m.Authorize, Caller: m.Caller,
	})
}

func Routes(am council.CouncilManager) []Route { return RoutesFor(am, Mount{}) }

func RoutesFor(am council.CouncilManager, m Mount) []Route {
	out, err := BuildFor(am, m)
	if err != nil {
		panic(fmt.Sprintf("council routes: %v", err))
	}
	return out
}

func Shape() []Route {
	s, err := operations()
	if err != nil {
		panic(fmt.Sprintf("council routes: %v", err))
	}
	return dispatch.Shape(s)
}
