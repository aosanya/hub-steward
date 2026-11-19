package routes

import (
	"fmt"
	"sync"

	"github.com/aosanya/mwanachama-backend-shared/dispatch"
	"github.com/aosanya/mwanachama-backend-shared/httpwire"

	audit "wakalaserver/modules/audit"
)

type Route = httpwire.Route

var operations = sync.OnceValues(func() (*dispatch.Spec, error) {
	return dispatch.Parse(audit.Operations())
})

var sentinels = map[string]error{
	"ErrInvalidEntry": audit.ErrInvalidEntry,
}

var AnonymousActions []string

type Mount struct {
	Authorize dispatch.Authorizer
	Caller    dispatch.Caller
}

func Build(am audit.AuditManager) ([]Route, error) { return BuildFor(am, Mount{}) }

func BuildFor(am audit.AuditManager, m Mount) ([]Route, error) {
	s, err := operations()
	if err != nil {
		return nil, err
	}
	return dispatch.Dispatch(s, dispatch.Deps{
		Manager: am, Errors: sentinels, Authorize: m.Authorize, Caller: m.Caller,
	})
}

func Routes(am audit.AuditManager) []Route { return RoutesFor(am, Mount{}) }

func RoutesFor(am audit.AuditManager, m Mount) []Route {
	out, err := BuildFor(am, m)
	if err != nil {
		panic(fmt.Sprintf("audit routes: %v", err))
	}
	return out
}

func Shape() []Route {
	s, err := operations()
	if err != nil {
		panic(fmt.Sprintf("audit routes: %v", err))
	}
	return dispatch.Shape(s)
}
