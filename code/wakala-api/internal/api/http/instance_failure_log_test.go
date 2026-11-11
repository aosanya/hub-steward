package http

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type registryThatFails struct {
	agencies.Registry
	cause       error
	memberCheck error
}

func (r registryThatFails) IsMember(context.Context, string, string) (bool, error) {
	return r.memberCheck == nil, r.memberCheck
}

func (registryThatFails) AdoptCaller(context.Context, string, string) error { return nil }

func (r registryThatFails) MembershipsFor(context.Context, string) ([]agencies.Membership, error) {
	return nil, nil
}

func (r registryThatFails) CreateInstance(context.Context, string) (agencies.Instance, error) {
	return agencies.Instance{}, r.cause
}

func (r registryThatFails) GetInstance(context.Context, string) (agencies.Instance, error) {
	return agencies.Instance{}, r.cause
}

func captureLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var out bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&out, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	return &out
}

func getInstanceThroughTheMux(reg agencies.Registry) *httptest.ResponseRecorder {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /instances/{instanceID}", getInstance(reg))
	req := httptest.NewRequest(http.MethodGet, "/instances/inst-1", nil)
	req = req.WithContext(accounts.WithID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()
	failureLogged(mux).ServeHTTP(rec, req)
	return rec
}

func TestInstanceRouteThatFailsInsideTheRegistryLogsTheCauseOnce(t *testing.T) {
	logged := captureLog(t)
	cause := errors.New("provision forms tables: relation \"forms_x\" does not exist")

	rec := getInstanceThroughTheMux(registryThatFails{cause: cause})

	if rec.Code != http.StatusInternalServerError || !strings.Contains(rec.Body.String(), `"internal error"`) {
		t.Fatalf("the caller still gets the opaque 500: %d %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "forms_x") {
		t.Fatalf("the cause leaked to the caller: %s", rec.Body.String())
	}
	line := logged.String()
	for _, want := range []string{"forms_x", "inst-1", "GET /instances/{instanceID}"} {
		if !strings.Contains(line, want) {
			t.Errorf("the log line lacks %q: %s", want, line)
		}
	}
	if n := strings.Count(line, "\n"); n != 1 {
		t.Errorf("want exactly one log line, got %d: %s", n, line)
	}
}

func TestInstanceRouteThatFindsNoInstanceLogsNothing(t *testing.T) {
	logged := captureLog(t)

	rec := getInstanceThroughTheMux(registryThatFails{cause: agencies.ErrInstanceNotFound})

	if rec.Code != http.StatusNotFound {
		t.Fatalf("an unknown instance is a 404: %d", rec.Code)
	}
	if logged.Len() != 0 {
		t.Fatalf("a 404 is not logged: %s", logged.String())
	}
}

func TestInstanceErrorWrittenWithoutARouteStillLogsTheCause(t *testing.T) {
	logged := captureLog(t)
	rec := httptest.NewRecorder()

	writeInstanceErr(rec, errors.New("store down"))

	if rec.Code != http.StatusInternalServerError || !strings.Contains(logged.String(), "store down") {
		t.Fatalf("code %d, log %q", rec.Code, logged.String())
	}
}

func TestInstanceRouteWhoseMembershipCheckFailsLogsTheCauseButNotToTheCaller(t *testing.T) {
	logged := captureLog(t)

	rec := getInstanceThroughTheMux(registryThatFails{memberCheck: errors.New("members table unreachable")})

	if rec.Code != http.StatusInternalServerError || strings.Contains(rec.Body.String(), "unreachable") {
		t.Fatalf("opaque 500 expected: %d %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(logged.String(), "members table unreachable") || strings.Count(logged.String(), "\n") != 1 {
		t.Fatalf("one line with the cause expected: %q", logged.String())
	}
}

func TestCreatingAnInstanceThatFailsInsideTheRegistryLogsTheCause(t *testing.T) {
	logged := captureLog(t)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /instances", createInstance(registryThatFails{cause: errors.New("provision tables: out of connections")}))
	req := httptest.NewRequest(http.MethodPost, "/instances", strings.NewReader(`{"name":"Ward 3"}`))
	req = req.WithContext(accounts.WithID(req.Context(), "user-1"))
	rec := httptest.NewRecorder()

	failureLogged(mux).ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError || strings.Contains(rec.Body.String(), "connections") {
		t.Fatalf("opaque 500 expected: %d %s", rec.Code, rec.Body.String())
	}
	for _, want := range []string{"out of connections", "POST /instances"} {
		if !strings.Contains(logged.String(), want) {
			t.Errorf("the log line lacks %q: %s", want, logged.String())
		}
	}
}
