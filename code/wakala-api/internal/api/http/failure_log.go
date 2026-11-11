package http

import (
	"errors"
	"log/slog"
	"net/http"
)

type membershipUnavailable struct{ cause error }

func (membershipUnavailable) Error() string { return "internal error" }

type requestOfWriter struct {
	http.ResponseWriter
	request *http.Request
}

func (w *requestOfWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func (w *requestOfWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func failureLogged(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(&requestOfWriter{ResponseWriter: w, request: r}, r)
	})
}

func logInstanceFailure(w http.ResponseWriter, err error) {
	cause := err
	var hidden membershipUnavailable
	if errors.As(err, &hidden) {
		cause = hidden.cause
	}
	attrs := []any{"error", cause.Error()}
	if rw, ok := w.(*requestOfWriter); ok {
		attrs = append(attrs,
			"route", rw.request.Method+" "+rw.request.Pattern,
			"instance", rw.request.PathValue("instanceID"),
		)
	}
	slog.Default().Error("an instance route failed inside the registry", attrs...)
}
