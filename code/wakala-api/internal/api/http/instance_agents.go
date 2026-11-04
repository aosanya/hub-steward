package http

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/apikeys"
)

var (
	errAgentNeedsUser     = errors.New("user_id is required")
	errAgentAlreadyOwner  = errors.New("that caller is already an owner of this agency")
	errServiceNeedsAGrant = errors.New("a service is granted with its own grant, which needs an agency role")
)

type addAgentRequest struct {
	UserID string `json:"user_id"`
}

type agentMembership struct {
	InstanceID string `json:"instance_id"`
	UserID     string `json:"user_id"`
	Role       string `json:"role"`
}

func addAgent(ctx context.Context, reg agencies.Registry, instanceID, userID string) (agentMembership, error) {
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return agentMembership{}, agencies.ErrInstanceNotFound
	}
	role, err := reg.RoleOf(ctx, instanceID, caller)
	if err != nil {
		return agentMembership{}, err
	}
	switch role {
	case agencies.RoleOwner:
	case agencies.RoleAgent:
		return agentMembership{}, dispatch.ErrForbidden
	default:
		return agentMembership{}, agencies.ErrInstanceNotFound
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return agentMembership{}, errAgentNeedsUser
	}
	if apikeys.IsServiceCaller(userID) {
		return agentMembership{}, errServiceNeedsAGrant
	}
	current, err := reg.RoleOf(ctx, instanceID, userID)
	if err != nil {
		return agentMembership{}, err
	}
	if current == agencies.RoleOwner {
		return agentMembership{}, errAgentAlreadyOwner
	}
	if err := reg.AddMember(ctx, instanceID, userID, agencies.RoleAgent); err != nil {
		return agentMembership{}, err
	}
	return agentMembership{InstanceID: instanceID, UserID: userID, Role: agencies.RoleAgent}, nil
}

func writeAddAgentErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, dispatch.ErrForbidden):
		writeErr(w, http.StatusForbidden, err.Error())
	case errors.Is(err, errAgentNeedsUser), errors.Is(err, errServiceNeedsAGrant):
		writeErr(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, errAgentAlreadyOwner):
		writeErr(w, http.StatusConflict, err.Error())
	default:
		writeInstanceErr(w, err)
	}
}

func addAgentRoute(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req addAgentRequest
		if err := readJSON(r, &req); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid request body")
			return
		}
		out, err := addAgent(r.Context(), reg, r.PathValue("instanceID"), req.UserID)
		if err != nil {
			writeAddAgentErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, out)
	}
}
