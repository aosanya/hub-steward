package http

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type countingBody struct {
	remaining int
	read      int
	prefix    string
}

func newCountingBody(total int, prefix string) *countingBody {
	return &countingBody{remaining: total, prefix: prefix}
}

func (c *countingBody) Read(p []byte) (int, error) {
	if c.remaining == 0 {
		return 0, io.EOF
	}
	n := 0
	for n < len(p) && c.remaining > 0 {
		if c.read < len(c.prefix) {
			p[n] = c.prefix[c.read]
		} else {
			p[n] = 'a'
		}
		n++
		c.read++
		c.remaining--
	}
	return n, nil
}

func (c *countingBody) Close() error { return nil }

func anonymousJSONPost(path string, body io.Reader, length int64) *http.Request {
	req := httptest.NewRequest("POST", path, body)
	req.ContentLength = length
	req.Header.Set("Content-Type", "application/json")
	return req
}

func TestAnonymousBody_AStrangerPostingOneMegabyteToASignedInRouteIsNotReadInFull(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance + "/actor/hierarchies"
	body := newCountingBody(maxRequestBody, `{"name":"`)
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, anonymousJSONPost(path, body, -1))
	if rec.Code != http.StatusUnauthorized && rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("anonymous 1 MB body to a signed-in route: %d %s, want 401 or 413", rec.Code, rec.Body.String())
	}
	if body.read > anonymousJSONBodyBytes+1 {
		t.Fatalf("server read %d bytes of an anonymous body before refusing it, want at most %d", body.read, anonymousJSONBodyBytes+1)
	}
}

func TestAnonymousBody_ADeclaredLengthAboveTheAnonymousCapIsRefusedWithoutReadingAByte(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance + "/actor/hierarchies"
	body := newCountingBody(maxRequestBody, `{"name":"`)
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, anonymousJSONPost(path, body, maxRequestBody))
	if rec.Code != http.StatusUnauthorized && rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("anonymous 1 MB declared body: %d %s, want 401 or 413", rec.Code, rec.Body.String())
	}
	if body.read > bodySniffBytes {
		t.Fatalf("server read %d bytes of an anonymous body whose length it already knew was too large", body.read)
	}
}

func TestAnonymousBody_ThePublicDoorStillAnswers400ForANulByte(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance + "/forms/public-links/some-key/declarations"
	body := `{"respondent_id":"a\u0000b"}`
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, anonymousJSONPost(path, strings.NewReader(body), int64(len(body))))
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "respondent_id") {
		t.Fatalf("anonymous NUL at the public door: %d %s, want 400 naming respondent_id", rec.Code, rec.Body.String())
	}
}

func TestAnonymousBody_ANulByteLateInAnAnonymousBodyUnderTheCapIsStillRefused(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance + "/forms/public-links/some-key/declarations"
	body := `{"respondent_id":"` + strings.Repeat("a", anonymousJSONBodyBytes-1024) + `\u0000"}`
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, anonymousJSONPost(path, strings.NewReader(body), int64(len(body))))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("anonymous NUL near the end of a body under the cap: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestAnonymousBody_ASignedInCallerKeepsTheOneMegabyteScan(t *testing.T) {
	w, group, _, people := controlByteWalk(t)
	path := "/instances/" + w.instance + "/actor/groups/" + group + "/join"
	body := `{"message":"` + strings.Repeat("a", 5*anonymousJSONBodyBytes) + `\u0000"}`
	rec := sendRaw(w, "POST", path, body, "application/json", people["resident"])
	if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "message") {
		t.Fatalf("signed-in NUL in a body above the anonymous cap: %d %s, want 400 naming message", rec.Code, rec.Body.String())
	}
}

func TestAnonymousBody_ASignedInCallerAboveOneMegabyteStill413(t *testing.T) {
	w, group, _, people := controlByteWalk(t)
	path := "/instances/" + w.instance + "/actor/groups/" + group + "/join"
	body := `{"message":"` + strings.Repeat("a", maxRequestBody+10) + `"}`
	rec := sendRaw(w, "POST", path, body, "application/json", people["resident"])
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("signed-in oversized body: %d, want 413", rec.Code)
	}
}

func TestAnonymousBody_AnAnonymousBinaryBodyIsStillNotScanned(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance + "/actor/hierarchies"
	body := newCountingBody(maxRequestBody/2, "\x89PNG")
	req := httptest.NewRequest("POST", path, body)
	req.ContentLength = -1
	req.Header.Set("Content-Type", "application/octet-stream")
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, req)
	if strings.Contains(rec.Body.String(), "control character") {
		t.Fatalf("anonymous binary body was scanned: %d %s", rec.Code, rec.Body.String())
	}
	if body.read > bodySniffBytes {
		t.Fatalf("server read %d bytes of an anonymous binary body, want only the sniff", body.read)
	}
}
