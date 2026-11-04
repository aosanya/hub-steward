package routes

import (
	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/httpwire"

	sources "wakalaserver/modules/sources"
)

type Route = httpwire.Route

type Mount = dispatch.Mount

var Sentinels = map[string]error{
	"ErrSourceNotFound":      sources.ErrSourceNotFound,
	"ErrAnnotationNotFound":  sources.ErrAnnotationNotFound,
	"ErrInvalidSource":       sources.ErrInvalidSource,
	"ErrInvalidAnnotation":   sources.ErrInvalidAnnotation,
	"ErrInvalidVerification": sources.ErrInvalidVerification,
	"ErrUnverifiedCaller":    sources.ErrUnverifiedCaller,
	"ErrInvalidChunk":        sources.ErrInvalidChunk,
	"ErrInvalidDocument":     sources.ErrInvalidDocument,
	"ErrInvalidQuery":        sources.ErrInvalidQuery,
}

var AnonymousActions = []string{}

var Table = dispatch.NewTable(sources.Operations(), Sentinels, AnonymousActions...)

func Build(sm sources.SourceManager) ([]Route, error) { return Table.Build(sm, Mount{}) }

func BuildFor(sm sources.SourceManager, m Mount) ([]Route, error) { return Table.Build(sm, m) }

func Routes(sm sources.SourceManager) []Route { return Table.Routes(sm, Mount{}) }

func RoutesFor(sm sources.SourceManager, m Mount) []Route { return Table.Routes(sm, m) }

func Split(sm sources.SourceManager, m Mount) dispatch.Split { return Table.Split(sm, m) }

func PublicRoutes(sm sources.SourceManager) []Route {
	return Table.Split(sm, Mount{}).Anonymous
}

func GatedRoutes(sm sources.SourceManager, m Mount) []Route {
	return Table.Split(sm, m).Gated
}
