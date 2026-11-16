package http

import (
	"errors"
	"net/http"
	"strings"

	"wakalaserver/internal/agencies"
)

func (d *Deps) GitRoute() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		agency, rest, ok := strings.Cut(strings.TrimPrefix(r.URL.Path, gitRoutePrefix), "/")
		if !ok || agency == "" || rest == "" {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		manager, err := d.Registry.GitManager(r.Context(), agency)
		if errors.Is(err, agencies.ErrInstanceNotFound) {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		inner := r.Clone(r.Context())
		inner.URL.Path = "/" + rest
		manager.SmartHTTPHandler().ServeHTTP(w, inner)
	})
}
