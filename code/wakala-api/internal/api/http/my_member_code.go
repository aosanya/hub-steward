package http

import (
	"context"

	mwanachamaactor "wakalaserver/modules/actor"
	actormodels "wakalaserver/modules/actor/models"
)

const readMyActor = "actor.actor.read_mine"

type internalCodeWithheld struct {
	mwanachamaactor.UserManager
}

func (m internalCodeWithheld) GetActor(ctx context.Context, id string) (actormodels.Actor, error) {
	held, err := m.UserManager.GetActor(ctx, id)
	held.Code = ""
	return held, err
}

func withheldFromMembers(m mwanachamaactor.UserManager, action string) mwanachamaactor.UserManager {
	if action == readMyActor {
		return internalCodeWithheld{m}
	}
	return m
}
