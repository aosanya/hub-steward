package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/internal/accounts"
)

func forgedCredentialPost(path string, body *countingBody, length int64, cookie bool, bearer string) *http.Request {
	req := anonymousJSONPost(path, body, length)
	if cookie {
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "made-up-session"})
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	return req
}

func forgedCredentialCases() []struct {
	name   string
	cookie bool
	bearer string
} {
	return []struct {
		name   string
		cookie bool
		bearer string
	}{
		{"a made-up session cookie", true, ""},
		{"a made-up Bearer value", false, "made-up-token"},
		{"a made-up cookie and a made-up Bearer value", true, "made-up-token"},
		{"a made-up key-shaped Bearer value", false, "wk_aaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
	}
}

func TestForgedCredential_AMadeUpCredentialDoesNotBuyTheOneMegabyteScan(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance + "/actor/hierarchies"
	for _, c := range forgedCredentialCases() {
		t.Run(c.name, func(t *testing.T) {
			body := newCountingBody(maxRequestBody, `{"name":"`)
			rec := httptest.NewRecorder()
			w.handler.ServeHTTP(rec, forgedCredentialPost(path, body, -1, c.cookie, c.bearer))
			if rec.Code != http.StatusUnauthorized && rec.Code != http.StatusRequestEntityTooLarge {
				t.Fatalf("1 MB body with %s: %d %s, want 401 or 413", c.name, rec.Code, rec.Body.String())
			}
			if body.read > anonymousJSONBodyBytes+1 {
				t.Fatalf("server read %d bytes of a body sent with %s, want at most %d", body.read, c.name, anonymousJSONBodyBytes+1)
			}
		})
	}
}

func TestForgedCredential_ADeclaredLengthWithAMadeUpCredentialIsRefusedWithoutReadingAByte(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance + "/actor/hierarchies"
	for _, c := range forgedCredentialCases() {
		t.Run(c.name, func(t *testing.T) {
			body := newCountingBody(maxRequestBody, `{"name":"`)
			rec := httptest.NewRecorder()
			w.handler.ServeHTTP(rec, forgedCredentialPost(path, body, maxRequestBody, c.cookie, c.bearer))
			if rec.Code != http.StatusUnauthorized && rec.Code != http.StatusRequestEntityTooLarge {
				t.Fatalf("declared 1 MB body with %s: %d %s, want 401 or 413", c.name, rec.Code, rec.Body.String())
			}
			if body.read > bodySniffBytes {
				t.Fatalf("server read %d bytes of a body sent with %s whose length it already knew was too large", body.read, c.name)
			}
		})
	}
}

func TestForgedCredential_ThePublicDoorKeepsItsNulRefusalForAMadeUpCredential(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance + "/forms/public-links/some-key/declarations"
	body := `{"respondent_id":"a\u0000b"}`
	req := anonymousJSONPost(path, strings.NewReader(body), int64(len(body)))
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "made-up-session"})
	req.Header.Set("Authorization", "Bearer made-up-token")
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "respondent_id") {
		t.Fatalf("NUL at the public door with made-up credentials: %d %s, want 400 naming respondent_id", rec.Code, rec.Body.String())
	}
}

func TestForgedCredential_AGenuineAPIKeyKeepsTheOneMegabyteScan(t *testing.T) {
	w, group, _, _ := controlByteWalk(t)
	ctx := accounts.WithID(context.Background(), "key-owner")
	_, token, err := w.deps.APIKeys.Create(ctx, "scan")
	if err != nil {
		t.Fatalf("mint a key: %v", err)
	}
	if _, err := w.deps.APIKeys.Verify(context.Background(), token); err != nil {
		t.Fatalf("verify the minted key: %v", err)
	}
	path := "/instances/" + w.instance + "/actor/groups/" + group + "/join"
	body := `{"message":"` + strings.Repeat("a", 5*anonymousJSONBodyBytes) + `\u0000"}`
	req := httptest.NewRequest("POST", path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "message") {
		t.Fatalf("NUL above the anonymous cap with a genuine API key: %d %s, want 400 naming message", rec.Code, rec.Body.String())
	}
}
