package http

import (
	"net/http"
	"strings"
)

func limitRequestBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		limit := bodyLimitFor(r)
		if r.ContentLength > limit {
			writeErr(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, limit)
		}
		next.ServeHTTP(w, r)
	})
}

func bodyLimitFor(r *http.Request) int64 {
	if strings.HasPrefix(r.URL.Path, gitRoutePrefix) {
		return maxGitPushBody
	}
	return maxRequestBody
}
