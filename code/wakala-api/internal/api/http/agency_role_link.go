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
	errOnlyAgentsLink     = errors.New("only an agent membership can be linked to an agency role")
	errUnknownAgencyRole  = errors.New("that agency role does not exist in this agency")
	errRoleLinksNotServed = errors.New("agency role links are not available")
	errServiceStaysLinked = errors.New("a service stays linked to an agency role; revoke the service to take it out of this agency")
)

type agencyRoleLinkRequest struct {
	AgencyRoleID string `json:"agency_role_id"`
}

type agencyRoleLink struct {
	InstanceID   string `json:"instance_id"`
	UserID       string `json:"user_id"`
	AgencyRoleID string `json:"agency_role_id"`
}

func registerAgencyRoleLinkRoute(mux *http.ServeMux, d *Deps, auth callers) {
	mux.HandleFunc("PUT /instances/{instanceID}/members/{memberID}/agency-role", auth.require(d.linkAgencyRole))
}

func (d *Deps) linkAgencyRole(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	instanceID, memberID := r.PathValue("instanceID"), r.PathValue("memberID")
	caller := accounts.IDFromContext(ctx)
	callerRole, err := d.Registry.RoleOf(ctx, instanceID, caller)
	if caller == "" || err != nil || (callerRole != agencies.RoleOwner && callerRole != agencies.RoleAgent) {
		writeErr(w, http.StatusNotFound, agencies.ErrInstanceNotFound.Error())
		return
	}
	if callerRole != agencies.RoleOwner {
		writeErr(w, http.StatusForbidden, dispatch.ErrForbidden.Error())
		return
	}
	var req agencyRoleLinkRequest
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	links, ok := d.Registry.(agencies.AgencyRoleLinks)
	if !ok {
		writeErr(w, http.StatusNotImplemented, errRoleLinksNotServed.Error())
		return
	}
	targetRole, err := d.Registry.RoleOf(ctx, instanceID, memberID)
	if err != nil || targetRole == "" {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if targetRole != agencies.RoleAgent {
		writeErr(w, http.StatusUnprocessableEntity, errOnlyAgentsLink.Error())
		return
	}
	roleID := strings.TrimSpace(req.AgencyRoleID)
	if roleID == "" && apikeys.IsServiceCaller(memberID) {
		writeErr(w, http.StatusUnprocessableEntity, errServiceStaysLinked.Error())
		return
	}
	if roleID != "" {
		if _, err := d.agencyRolePermissions(context.WithValue(ctx, partitionKey{}, instanceID), roleID); err != nil {
			writeErr(w, http.StatusUnprocessableEntity, errUnknownAgencyRole.Error())
			return
		}
	}
	if err := links.SetAgencyRole(ctx, instanceID, memberID, roleID); err != nil {
		writeInstanceErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, agencyRoleLink{InstanceID: instanceID, UserID: memberID, AgencyRoleID: roleID})
}
