package routes

import (
	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/httpwire"

	engage "wakalaserver/modules/engage"
)

type Route = httpwire.Route

type Mount = dispatch.Mount

var Sentinels = map[string]error{
	"ErrConsentRequired":  engage.ErrConsentRequired,
	"ErrConsentWithdrawn": engage.ErrConsentWithdrawn,
	"ErrPostNotFound":     engage.ErrPostNotFound,
	"ErrInvalidPost":      engage.ErrInvalidPost,
	"ErrNoPoster":         engage.ErrNoPoster,
	"ErrNoReader":         engage.ErrNoReader,
	"ErrNotANotice":       engage.ErrNotANotice,
	"ErrNoResponder":      engage.ErrNoResponder,
	"ErrInvalidRSVP":      engage.ErrInvalidRSVP,
	"ErrNotAnOpenEvent":   engage.ErrNotAnOpenEvent,
	"ErrEventStarted":     engage.ErrEventStarted,
	"ErrNoVolunteer":      engage.ErrNoVolunteer,
	"ErrNotAnOpenCall":    engage.ErrNotAnOpenCall,
	"ErrNotThePoster":     engage.ErrNotThePoster,
	"ErrOfferNotFound":    engage.ErrOfferNotFound,
	"ErrCallFull":         engage.ErrCallFull,
	"ErrNoAttendee":       engage.ErrNoAttendee,
	"ErrOutsideEvent":     engage.ErrOutsideEvent,
	"ErrNotCheckedIn":     engage.ErrNotCheckedIn,
	"ErrOfferPicked":      engage.ErrOfferPicked,
	"ErrPickNotFound":     engage.ErrPickNotFound,
}

var AnonymousActions = []string{}

var Table = dispatch.NewTable(engage.Operations(), Sentinels, AnonymousActions...)

func Build(pm engage.PostManager) ([]Route, error) { return Table.Build(pm, Mount{}) }

func BuildFor(pm engage.PostManager, m Mount) ([]Route, error) { return Table.Build(pm, m) }

func RoutesFor(pm engage.PostManager, m Mount) []Route { return Table.Routes(pm, m) }

func Split(pm engage.PostManager, m Mount) dispatch.Split { return Table.Split(pm, m) }
