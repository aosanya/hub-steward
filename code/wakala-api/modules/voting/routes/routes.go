package routes

import (
	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/httpwire"

	voting "wakalaserver/modules/voting"
)

type Route = httpwire.Route

type Mount = dispatch.Mount

var Sentinels = map[string]error{
	"ErrPollNotFound":       voting.ErrPollNotFound,
	"ErrInvalidPoll":        voting.ErrInvalidPoll,
	"ErrInvalidChoice":      voting.ErrInvalidChoice,
	"ErrNoCreator":          voting.ErrNoCreator,
	"ErrPollNotDraft":       voting.ErrPollNotDraft,
	"ErrNoAnswerer":         voting.ErrNoAnswerer,
	"ErrOutsideWindow":      voting.ErrOutsideWindow,
	"ErrNotInPollGroups":    voting.ErrNotInPollGroups,
	"ErrInvalidAnswer":      voting.ErrInvalidAnswer,
	"ErrAlreadyAnswered":    voting.ErrAlreadyAnswered,
	"ErrNoPublisher":        voting.ErrNoPublisher,
	"ErrInvalidPublication": voting.ErrInvalidPublication,
	"ErrNoReader":           voting.ErrNoReader,
}

var AnonymousActions = []string{}

var Table = dispatch.NewTable(voting.Operations(), Sentinels, AnonymousActions...)

func Build(pm voting.PollManager) ([]Route, error) { return Table.Build(pm, Mount{}) }

func BuildFor(pm voting.PollManager, m Mount) ([]Route, error) { return Table.Build(pm, m) }

func RoutesFor(pm voting.PollManager, m Mount) []Route { return Table.Routes(pm, m) }

func Split(pm voting.PollManager, m Mount) dispatch.Split { return Table.Split(pm, m) }
