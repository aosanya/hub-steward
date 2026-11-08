package http

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRequestBody_OwnerCannotDoSendOversizedOrDeeplyNestedBody(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	path := "/instances/" + w.instance + "/join-mode"
	send := func(body []byte, chunked bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest("PUT", path, bytes.NewReader(body))
		if chunked {
			req.ContentLength = -1
		}
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(w.owner)
		rec := httptest.NewRecorder()
		w.handler.ServeHTTP(rec, req)
		return rec
	}

	oversized := []byte(`{"join_mode":"` + strings.Repeat("a", 2<<20) + `"}`)
	if rec := send(oversized, false); rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized body with a length: %d %s, want 413", rec.Code, rec.Body.String())
	}
	if rec := send(oversized, true); rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized body without a length: %d %s, want 413", rec.Code, rec.Body.String())
	}
	nested := []byte(`{"join_mode":` + strings.Repeat("[", 5000) + strings.Repeat("]", 5000) + `}`)
	if rec := send(nested, false); rec.Code != http.StatusBadRequest {
		t.Fatalf("body nested 5000 levels deep: %d %s, want 400", rec.Code, rec.Body.String())
	}

	if rec := send([]byte(`{"join_mode":"confirmed"}`), false); rec.Code != http.StatusOK {
		t.Fatalf("normal body: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
