package routes

import (
	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/httpwire"

	custody "wakalaserver/modules/custody"
)

type Route = httpwire.Route

type Mount = dispatch.Mount

var Sentinels = map[string]error{
	"ErrNotFound":            custody.ErrNotFound,
	"ErrConsentRequired":     custody.ErrConsentRequired,
	"ErrConsentWithdrawn":    custody.ErrConsentWithdrawn,
	"ErrAlreadyPublished":    custody.ErrAlreadyPublished,
	"ErrUnknownScope":        custody.ErrUnknownScope,
	"ErrUnknownActClass":     custody.ErrUnknownActClass,
	"ErrUnknownEventChip":    custody.ErrUnknownEventChip,
	"ErrInvalidLimit":        custody.ErrInvalidLimit,
	"ErrInvalidSince":        custody.ErrInvalidSince,
	"ErrStructureIDRequired": custody.ErrStructureIDRequired,
	"ErrNotSelf":             custody.ErrNotSelf,
	"ErrNoMechanicsInForce":  custody.ErrNoMechanicsInForce,
}

var AnonymousActions = []string{}

var Table = dispatch.NewTable(custody.Operations(), Sentinels, AnonymousActions...)

func Build(cm *custody.CustodyManager) ([]Route, error) { return Table.Build(cm, Mount{}) }

func BuildFor(cm *custody.CustodyManager, m Mount) ([]Route, error) { return Table.Build(cm, m) }

func RoutesFor(cm *custody.CustodyManager, m Mount) []Route { return Table.Routes(cm, m) }

func Split(cm *custody.CustodyManager, m Mount) dispatch.Split { return Table.Split(cm, m) }
