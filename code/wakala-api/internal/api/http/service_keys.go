package http

import (
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"net/http"
	"time"

	"wakalaserver/internal/apikeys"
)

const adminTokenHeader = "X-Admin-Token"

var errMachineCannotCreate = errors.New("an agency key or a service key cannot create an agency")

func isMachineCaller(caller string) bool {
	return apikeys.IsAgencyKeyCaller(caller) || apikeys.IsServiceCaller(caller)
}

func adminTokenMatches(configured, presented string) bool {
	if configured == "" || presented == "" {
		return false
	}
	want, got := sha256.Sum256([]byte(configured)), sha256.Sum256([]byte(presented))
	return subtle.ConstantTimeCompare(want[:], got[:]) == 1
}

func adminOnly(adminToken string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !adminTokenMatches(adminToken, r.Header.Get(adminTokenHeader)) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		next(w, r)
	}
}

type createServiceKeyRequest struct {
	Service string `json:"service"`
	Name    string `json:"name"`
}

type serviceKeyListing struct {
	ID        string     `json:"id"`
	Service   string     `json:"service"`
	Name      string     `json:"name"`
	CreatedAt time.Time  `json:"created_at"`
	RevokedAt *time.Time `json:"revoked_at"`
}

type serviceListing struct {
	Service string `json:"service"`
	Subject string `json:"subject"`
}

func createServiceKey(keys apikeys.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in createServiceKeyRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		key, token, err := keys.CreateService(r.Context(), in.Service, in.Name)
		if errors.Is(err, apikeys.ErrInvalidService) || errors.Is(err, apikeys.ErrInvalidKeyName) {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"id":         key.ID,
			"service":    key.Service,
			"subject":    key.AccountID,
			"name":       key.Name,
			"created_at": key.CreatedAt,
			"token":      token,
		})
	}
}

func listServiceKeys(keys apikeys.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		held, err := keys.ListServices(r.Context())
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		out := make([]serviceKeyListing, len(held))
		for i, k := range held {
			out[i] = serviceKeyListing{ID: k.ID, Service: k.Service, Name: k.Name, CreatedAt: k.CreatedAt, RevokedAt: k.RevokedAt}
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func revokeServiceKey(keys apikeys.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		err := keys.RevokeService(r.Context(), r.PathValue("keyID"))
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

func listServices(keys apikeys.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		live, err := keys.LiveServices(r.Context())
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		out := make([]serviceListing, len(live))
		for i, name := range live {
			out[i] = serviceListing{Service: name, Subject: apikeys.ServiceCaller(name)}
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func registerServiceKeyRoutes(mux *http.ServeMux, adminToken string, keys apikeys.Manager, auth callers) {
	mux.HandleFunc("POST /auth/service-keys", adminOnly(adminToken, createServiceKey(keys)))
	mux.HandleFunc("GET /auth/service-keys", adminOnly(adminToken, listServiceKeys(keys)))
	mux.HandleFunc("DELETE /auth/service-keys/{keyID}", adminOnly(adminToken, revokeServiceKey(keys)))
	mux.HandleFunc("GET /services", auth.require(listServices(keys)))
}
