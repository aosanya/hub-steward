package http

import (
	"net/http"
	"strings"
	"time"
)

func isEventStream(r *http.Request) bool {
	return r.Method == http.MethodGet && strings.Contains(r.Header.Get("Accept"), "text/event-stream")
}

func withWriteDeadline(limit time.Duration, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isEventStream(r) {
			_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(limit))
		}
		next.ServeHTTP(w, r)
	})
}
