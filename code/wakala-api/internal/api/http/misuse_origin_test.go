package http

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func postInstanceFrom(h http.Handler, origin string, as *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/instances", bytes.NewReader([]byte(`{"name":"Library friends"}`)))
	req.Header.Set("Content-Type", "application/json")
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	req.AddCookie(as)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestOriginGuard_ForeignSiteCannotDoStateChangeWithSessionCookie(t *testing.T) {
	w := newStepRunWalk(t, nil)
	w.deps.StudioOrigins = []string{"https://studio.example.test"}
	h := NewRouter(w.deps)

	if rec := postInstanceFrom(h, "https://elsewhere.example.test", w.owner); rec.Code != http.StatusForbidden {
		t.Fatalf("foreign origin with session cookie: %d %s, want 403", rec.Code, rec.Body.String())
	}

	if rec := postInstanceFrom(h, "https://studio.example.test", w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("allowed origin with session cookie: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
