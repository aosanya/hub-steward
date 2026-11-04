package http

import (
	"context"
	"errors"
	"net/http"

	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/apikeys"
	"wakalaserver/internal/session"
	"wakalaserver/internal/throttle"
)

func mustOwnAgency(ctx context.Context, reg agencies.Registry, instanceID string) error {
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return agencies.ErrInstanceNotFound
	}
	role, err := reg.RoleOf(ctx, instanceID, caller)
	if err != nil {
		return err
	}
	switch role {
	case agencies.RoleOwner:
		return nil
	case agencies.RoleAgent:
		return dispatch.ErrForbidden
	}
	return agencies.ErrInstanceNotFound
}

func createAgencyAPIKey(reg agencies.Registry, keys apikeys.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in createAPIKeyRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		if in.Name == "" {
			writeErr(w, http.StatusBadRequest, "name must not be empty")
			return
		}
		instanceID := r.PathValue("instanceID")
		if err := mustOwnAgency(r.Context(), reg, instanceID); err != nil {
			writeAddAgentErr(w, err)
			return
		}
		if len(in.Name) > throttle.MaxAPIKeyNameBytes {
			writeErr(w, http.StatusBadRequest, "name is too long")
			return
		}
		key, token, err := keys.CreateForAgency(r.Context(), in.Name, instanceID)
		if errors.Is(err, apikeys.ErrTooManyKeys) {
			writeKeyLimit(w)
			return
		}
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		if err := reg.AddMember(r.Context(), instanceID, key.AccountID, agencies.RoleAgent); err != nil {
			_ = keys.Revoke(r.Context(), key.ID)
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"id":          key.ID,
			"name":        key.Name,
			"instance_id": instanceID,
			"role":        agencies.RoleAgent,
			"created_at":  key.CreatedAt,
			"token":       token,
		})
	}
}

func registerAgencyAPIKeyRoutes(mux *http.ServeMux, sessions session.Manager, reg agencies.Registry, keys apikeys.Manager) {
	mux.HandleFunc("POST /instances/{instanceID}/api-keys", requireSession(sessions, createAgencyAPIKey(reg, keys)))
}
