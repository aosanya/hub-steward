package http

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"context"

	"wakalaserver/internal/apikeys"
)

type verifyFails struct {
	apikeys.Manager
	err error
}

func (v verifyFails) Verify(context.Context, string) (apikeys.Key, error) {
	return apikeys.Key{}, v.err
}

func requireWith(err error) (*httptest.ResponseRecorder, *bool) {
	reached := false
	handler := callers{keys: verifyFails{err: err}}.require(func(http.ResponseWriter, *http.Request) { reached = true })
	r := httptest.NewRequest("POST", "/mcp", strings.NewReader(""))
	r.Header.Set("Authorization", "Bearer wak_id.secret")
	rec := httptest.NewRecorder()
	handler(rec, r)
	return rec, &reached
}

func TestRequire_ABadKeyStillAnswers401(t *testing.T) {
	rec, reached := requireWith(apikeys.ErrInvalidKey)
	if rec.Code != http.StatusUnauthorized || *reached {
		t.Fatalf("bad key = %d reached=%v, want 401", rec.Code, *reached)
	}
}

func TestRequire_AKeyLookupFailureAnswers503AndLogsTheCauseOnce(t *testing.T) {
	log := captureLog(t)
	rec, reached := requireWith(errors.Join(apikeys.ErrLookupFailed, errors.New("sql: database is closed")))
	if rec.Code != http.StatusServiceUnavailable || *reached {
		t.Fatalf("lookup failure = %d reached=%v, want 503", rec.Code, *reached)
	}
	if strings.Count(log.String(), "sql: database is closed") != 1 || strings.Contains(log.String(), "wak_id.secret") {
		t.Fatalf("log = %q, want the cause once and no credential", log.String())
	}
}

func TestRecognises_AKeyLookupFailureRecognisesNobody(t *testing.T) {
	c := callers{keys: verifyFails{err: apikeys.ErrLookupFailed}}
	r := httptest.NewRequest("POST", "/mcp", strings.NewReader(""))
	r.Header.Set("Authorization", "Bearer wak_id.secret")
	if c.recognises(r) {
		t.Fatal("a failed lookup recognised the caller")
	}
}
