package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAnonymousDoor_StrangerCannotDoEscapeTheCapByRotatingForwardedHeaders(t *testing.T) {
	door := newAnonymousDoor(3, 1024)
	handler := door.guard(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	send := func(remote, forwarded string) int {
		req := httptest.NewRequest("POST", "/instances/a/forms/public-links/k/respondents", strings.NewReader("{}"))
		req.RemoteAddr = remote
		req.Header.Set("X-Forwarded-For", forwarded)
		req.Header.Set("X-Real-IP", forwarded)
		rec := httptest.NewRecorder()
		handler(rec, req)
		return rec.Code
	}
	for i, f := range []string{"10.0.0.1", "10.0.0.2", "10.0.0.3"} {
		if code := send("192.0.2.7:4000", f); code != http.StatusOK {
			t.Fatalf("request %d within the cap: %d, want 200", i+1, code)
		}
	}
	for _, f := range []string{"10.0.0.4", "10.0.0.5", ""} {
		if code := send("192.0.2.7:4001", f); code != http.StatusTooManyRequests {
			t.Fatalf("flooding client presenting forwarded address %q: %d, want 429", f, code)
		}
	}
	if code := send("198.51.100.9:5000", ""); code != http.StatusOK {
		t.Fatalf("another client after the flood: %d, want 200", code)
	}
}
