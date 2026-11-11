package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAddress_NulByteInAPathValueNeverReachesPostgres(t *testing.T) {
	w := newConsentWalkOn(t, localPostgresOrSkip(t))
	for _, target := range []string{
		"/instances/" + w.instance + "/forms/public-links/ab%00cd",
		"/instances/" + w.instance + "/forms/forms/ab%00cd",
		"/instances/" + w.instance + "/members/ab%00cd",
	} {
		req := httptest.NewRequest("GET", target, nil)
		req.AddCookie(w.owner)
		rec := httptest.NewRecorder()
		w.handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s: %d %s, want 400", target, rec.Code, rec.Body.String())
		}
	}
}
