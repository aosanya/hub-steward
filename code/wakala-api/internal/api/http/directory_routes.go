package http

import (
	"net/http"
	"strings"
	"unicode/utf8"

	"wakalaserver/internal/agencies"
)

const maxDirectoryQuery = 200

func registerDirectoryRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	mux.HandleFunc("PUT /instances/{instanceID}/listing", auth.require(setListing(reg)))
	mux.HandleFunc("GET /directory", auth.require(searchDirectory(reg)))
}

func setListing(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		if err := mustBeMember(r.Context(), reg, instanceID); err != nil {
			writeInstanceErr(w, err)
			return
		}
		var in agencies.ListingChange
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		out, err := reg.SetListing(r.Context(), instanceID, in)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func searchDirectory(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := strings.TrimSpace(r.URL.Query().Get("q"))
		if utf8.RuneCountInString(query) > maxDirectoryQuery {
			writeErr(w, http.StatusBadRequest, "q is too long")
			return
		}
		out, err := reg.SearchDirectory(r.Context(), query)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}
