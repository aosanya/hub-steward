package http

import (
	"net/http"
	"strconv"
	"time"

	"wakalaserver/internal/throttle"
)

const (
	formRespondentAction  = "forms.respondent.register"
	formDeclarationAction = "forms.declaration.create"
)

type anonymousDoor struct {
	window   *throttle.Window
	maxBytes int64
}

func newAnonymousDoor(perMinute int, maxBytes int64) *anonymousDoor {
	return &anonymousDoor{
		window:   throttle.NewWindow(anonymousTrackedClients, perMinute, time.Minute),
		maxBytes: maxBytes,
	}
}

func (a *anonymousDoor) guard(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if ok, wait := a.window.Allow(clientAddress(r), time.Now()); !ok {
			w.Header().Set("Retry-After", strconv.Itoa(int(wait/time.Second)+1))
			writeErr(w, http.StatusTooManyRequests, "too many requests")
			return
		}
		if r.ContentLength > a.maxBytes {
			writeErr(w, http.StatusRequestEntityTooLarge, "request body too large")
			return
		}
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, a.maxBytes)
		}
		next(w, r)
	}
}

func (a *anonymousDoor) guardedWhenWriting(action string, next http.HandlerFunc) http.HandlerFunc {
	if action == formRespondentAction || action == formDeclarationAction {
		return a.guard(next)
	}
	return next
}
