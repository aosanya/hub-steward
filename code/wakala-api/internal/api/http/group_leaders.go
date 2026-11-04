package http

import (
	"context"
	"errors"
	"net/http"

	mwanachamaactor "wakalaserver/modules/actor"
	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
)

type groupNamed func(ctx context.Context, m mwanachamaactor.UserManager, r *http.Request) (string, error)

var leaderActorActions = map[string]groupNamed{
	"actor.join_request.list_for_group": groupInPath,
	"actor.invitation.create":           groupInPath,
	"actor.invitation.list_for_group":   groupInPath,
	"actor.group.set_join_mode":         groupInPath,
	"actor.group.set_hidden":            groupInPath,
	"actor.join_request.approve":        groupOfRequestInPath,
	"actor.join_request.decline":        groupOfRequestInPath,
}

func groupInPath(_ context.Context, _ mwanachamaactor.UserManager, r *http.Request) (string, error) {
	return r.PathValue("group_id"), nil
}

func groupOfRequestInPath(ctx context.Context, m mwanachamaactor.UserManager, r *http.Request) (string, error) {
	req, err := m.GetJoinRequest(ctx, r.PathValue("request_id"))
	if errors.Is(err, mwanachamaactor.ErrJoinRequestNotFound) {
		return "", nil
	}
	return req.GroupID, err
}

func residentLeadsTheGroupNamed(r *http.Request, m mwanachamaactor.UserManager, action string) error {
	named, isLeaderAction := leaderActorActions[action]
	if !isLeaderAction {
		return nil
	}
	ctx := r.Context()
	groupID, err := named(ctx, m, r)
	if err != nil {
		return err
	}
	leads, err := m.IsGroupLeader(ctx, groupID, accounts.IDFromContext(ctx))
	if err != nil {
		return err
	}
	if !leads {
		return dispatch.ErrForbidden
	}
	return nil
}

func writeLeaderRefusal(w http.ResponseWriter, err error) {
	if errors.Is(err, dispatch.ErrForbidden) {
		writeErr(w, http.StatusForbidden, err.Error())
		return
	}
	writeErr(w, http.StatusInternalServerError, "internal error")
}
