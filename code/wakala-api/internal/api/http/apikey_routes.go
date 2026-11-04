// apikey_routes.go — decision #4's "API keys" half: an operator, already
// signed in via WK7's session cookie, mints/lists/revokes the bearer
// credential an MCP client (WK9) authenticates the core API with instead.
// Every route here is requireSession-gated (never requireCaller) — see
// middleware.go.
package http

import (
	"errors"
	"fmt"
	"net/http"

	"wakalaserver/internal/apikeys"
	"wakalaserver/internal/session"
	"wakalaserver/internal/throttle"
)

// createAPIKeyRequest is the wire shape for POST /auth/api-keys.
type createAPIKeyRequest struct {
	Name string `json:"name"`
}

// createAPIKey handles POST /auth/api-keys — the only response that ever
// carries the plaintext token.
func createAPIKey(keys apikeys.Manager) http.HandlerFunc {
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
		if len(in.Name) > throttle.MaxAPIKeyNameBytes {
			writeErr(w, http.StatusBadRequest, "name is too long")
			return
		}
		key, token, err := keys.Create(r.Context(), in.Name)
		if errors.Is(err, apikeys.ErrTooManyKeys) {
			writeKeyLimit(w)
			return
		}
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"id":         key.ID,
			"name":       key.Name,
			"created_at": key.CreatedAt,
			"token":      token,
		})
	}
}

func writeKeyLimit(w http.ResponseWriter) {
	writeErr(w, http.StatusConflict, fmt.Sprintf("this account already holds %d live API keys; revoke one before minting another", throttle.MaxLiveAPIKeysPerAccount))
}

// listAPIKeys handles GET /auth/api-keys — never the token, only what
// Create already showed once (id/name/created_at/revoked_at).
func listAPIKeys(keys apikeys.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		out, err := keys.List(r.Context())
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}

// revokeAPIKey handles DELETE /auth/api-keys/{keyID}.
func revokeAPIKey(keys apikeys.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		err := keys.Revoke(r.Context(), r.PathValue("keyID"))
		if errors.Is(err, apikeys.ErrKeyNotFound) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// registerAPIKeyRoutes mounts the API key management surface, every route
// requireSession-gated.
func registerAPIKeyRoutes(mux *http.ServeMux, sessions session.Manager, keys apikeys.Manager) {
	mux.HandleFunc("POST /auth/api-keys", requireSession(sessions, createAPIKey(keys)))
	mux.HandleFunc("GET /auth/api-keys", requireSession(sessions, listAPIKeys(keys)))
	mux.HandleFunc("DELETE /auth/api-keys/{keyID}", requireSession(sessions, revokeAPIKey(keys)))
}
