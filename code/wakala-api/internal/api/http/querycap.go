package http

import (
	"net/http"
	"net/url"
	"strings"
)

const unreadableQueryMessage = "the query string could not be read: too many parameters"

const queryCapProbeSegments = 1 << 20

var queryCapError = func() error {
	_, err := url.ParseQuery(strings.Repeat("&", queryCapProbeSegments))
	return err
}()

func isQueryCapError(err error) bool {
	return err != nil && queryCapError != nil && err.Error() == queryCapError.Error()
}

func refuseOversizedQuery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := url.ParseQuery(r.URL.RawQuery); isQueryCapError(err) {
			writeErr(w, http.StatusBadRequest, unreadableQueryMessage)
			return
		}
		next.ServeHTTP(w, r)
	})
}
