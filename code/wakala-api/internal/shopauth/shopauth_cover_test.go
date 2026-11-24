package shopauth

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type seen struct {
	method, path, query, apikey, auth, body string
}

func projectAnswering(t *testing.T, answer func(w http.ResponseWriter, r *http.Request), calls *[]seen) Verifier {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		*calls = append(*calls, seen{r.Method, r.URL.Path, r.URL.RawQuery, r.Header.Get("apikey"), r.Header.Get("Authorization"), string(b)})
		answer(w, r)
	}))
	t.Cleanup(srv.Close)
	return Verifier{URL: srv.URL + "/", AnonKey: "anon", HTTP: srv.Client()}
}

func status(code int) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(code) }
}

func TestConfiguredNeedsBothURLAndKey(t *testing.T) {
	cases := map[string]Verifier{
		"nothing":  {},
		"url only": {URL: "https://x"},
		"key only": {AnonKey: "k"},
	}
	for name, v := range cases {
		if v.Configured() {
			t.Errorf("%s: verifier reported configured", name)
		}
	}
	if !(Verifier{URL: "https://x", AnonKey: "k"}).Configured() {
		t.Error("verifier with both URL and key reported unconfigured")
	}
}

func TestUserRefusesWithoutAskingTheProject(t *testing.T) {
	var calls []seen
	v := projectAnswering(t, status(200), &calls)
	if _, err := v.User(context.Background(), ""); !errors.Is(err, ErrNotSignedIn) {
		t.Errorf("empty token: %v", err)
	}
	if _, err := (Verifier{}).User(context.Background(), "tok"); !errors.Is(err, ErrNotSignedIn) {
		t.Errorf("unconfigured verifier: %v", err)
	}
	if len(calls) != 0 {
		t.Errorf("project was asked %d times", len(calls))
	}
}

func TestUserReturnsTheProjectsIdAndSendsTheToken(t *testing.T) {
	var calls []seen
	v := projectAnswering(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"id":"u-1"}`))
	}, &calls)
	id, err := v.User(context.Background(), "tok")
	if err != nil || id != "u-1" {
		t.Fatalf("got %q, %v", id, err)
	}
	c := calls[0]
	if c.method != "GET" || c.path != "/auth/v1/user" || c.apikey != "anon" || c.auth != "Bearer tok" {
		t.Errorf("request was %+v", c)
	}
}

func TestUserRefusalsAllReadAsNotSignedIn(t *testing.T) {
	cases := map[string]func(http.ResponseWriter, *http.Request){
		"rejected token": status(401),
		"server error":   status(500),
		"no id":          func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(`{}`)) },
	}
	for name, answer := range cases {
		var calls []seen
		v := projectAnswering(t, answer, &calls)
		if _, err := v.User(context.Background(), "tok"); !errors.Is(err, ErrNotSignedIn) {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestUserSurfacesAnUnreachableProjectAndAMalformedBody(t *testing.T) {
	down := Verifier{URL: "http://127.0.0.1:1", AnonKey: "anon"}
	if _, err := down.User(context.Background(), "tok"); err == nil || errors.Is(err, ErrNotSignedIn) {
		t.Errorf("unreachable project: %v", err)
	}
	var calls []seen
	v := projectAnswering(t, func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(`not json`)) }, &calls)
	if _, err := v.User(context.Background(), "tok"); err == nil || errors.Is(err, ErrNotSignedIn) {
		t.Errorf("malformed body: %v", err)
	}
}

func adminProject(t *testing.T, rpcBody string, rpcCode int, calls *[]seen) Verifier {
	return projectAnswering(t, func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/auth/v1/user") {
			_, _ = w.Write([]byte(`{"id":"u-9"}`))
			return
		}
		w.WriteHeader(rpcCode)
		_, _ = w.Write([]byte(rpcBody))
	}, calls)
}

func TestAdminAcceptsOnlyAnAgencyAdmin(t *testing.T) {
	var calls []seen
	v := adminProject(t, "true", 200, &calls)
	id, err := v.Admin(context.Background(), "tok")
	if err != nil || id != "u-9" {
		t.Fatalf("got %q, %v", id, err)
	}
	rpc := calls[1]
	if rpc.method != "POST" || rpc.path != "/rest/v1/rpc/is_agency_admin" || rpc.auth != "Bearer tok" || rpc.body != "{}" {
		t.Errorf("rpc request was %+v", rpc)
	}
}

func TestAdminRefusesNonAdminsInTheSameWords(t *testing.T) {
	cases := map[string][]any{
		"false":        {"false", 200},
		"rpc error":    {"true", 500},
		"garbage body": {"nope", 200},
	}
	for name, c := range cases {
		var calls []seen
		v := adminProject(t, c[0].(string), c[1].(int), &calls)
		if _, err := v.Admin(context.Background(), "tok"); !errors.Is(err, ErrNotAdmin) {
			t.Errorf("%s: %v", name, err)
		}
	}
	var calls []seen
	v := projectAnswering(t, status(401), &calls)
	if _, err := v.Admin(context.Background(), "bad"); !errors.Is(err, ErrNotAdmin) {
		t.Errorf("rejected token: %v", err)
	}
	if _, err := v.Admin(context.Background(), ""); !errors.Is(err, ErrNotAdmin) {
		t.Errorf("empty token: %v", err)
	}
}

func TestAdminPassesAnUnreachableProjectThroughUntold(t *testing.T) {
	down := Verifier{URL: "http://127.0.0.1:1", AnonKey: "anon"}
	if _, err := down.Admin(context.Background(), "tok"); err == nil || errors.Is(err, ErrNotAdmin) {
		t.Errorf("got %v", err)
	}
}

func TestUserEmailIsTrimmedAndLowerCased(t *testing.T) {
	var calls []seen
	v := projectAnswering(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"email":"  Ann@Example.ORG "}`))
	}, &calls)
	if got := v.UserEmail(context.Background(), "tok"); got != "ann@example.org" {
		t.Errorf("got %q", got)
	}
}

func TestUserEmailIsEmptyWheneverTheProjectCannotSayIt(t *testing.T) {
	var calls []seen
	rejecting := projectAnswering(t, status(401), &calls)
	if got := rejecting.UserEmail(context.Background(), "tok"); got != "" {
		t.Errorf("rejected: %q", got)
	}
	if got := rejecting.UserEmail(context.Background(), ""); got != "" {
		t.Errorf("empty token: %q", got)
	}
	if got := (Verifier{}).UserEmail(context.Background(), "tok"); got != "" {
		t.Errorf("unconfigured: %q", got)
	}
	if got := (Verifier{URL: "http://127.0.0.1:1", AnonKey: "a"}).UserEmail(context.Background(), "tok"); got != "" {
		t.Errorf("unreachable: %q", got)
	}
}

func TestSendMagicLinkPostsTheEmailWithoutCreatingUsers(t *testing.T) {
	var calls []seen
	v := projectAnswering(t, status(200), &calls)
	if err := v.SendMagicLink(context.Background(), "a@b.c", "https://app/x?y=1&z=2"); err != nil {
		t.Fatal(err)
	}
	c := calls[0]
	if c.method != "POST" || c.path != "/auth/v1/otp" || c.auth != "Bearer anon" {
		t.Errorf("request was %+v", c)
	}
	if c.query != "redirect_to=https%3A%2F%2Fapp%2Fx%3Fy%3D1%26z%3D2" {
		t.Errorf("redirect not encoded: %q", c.query)
	}
	var body map[string]any
	if err := json.Unmarshal([]byte(c.body), &body); err != nil {
		t.Fatal(err)
	}
	if body["email"] != "a@b.c" || body["create_user"] != false {
		t.Errorf("body was %v", body)
	}
}

func TestSendMagicLinkRefusals(t *testing.T) {
	if err := (Verifier{}).SendMagicLink(context.Background(), "a@b.c", "x"); !errors.Is(err, ErrNoProject) {
		t.Errorf("unconfigured: %v", err)
	}
	var calls []seen
	limited := projectAnswering(t, status(429), &calls)
	if err := limited.SendMagicLink(context.Background(), "a@b.c", "x"); !errors.Is(err, ErrRateLimited) {
		t.Errorf("429: %v", err)
	}
	broken := projectAnswering(t, status(502), &calls)
	err := broken.SendMagicLink(context.Background(), "a@b.c", "x")
	if err == nil || !strings.Contains(err.Error(), "502") {
		t.Errorf("502: %v", err)
	}
	down := Verifier{URL: "http://127.0.0.1:1", AnonKey: "a"}
	if err := down.SendMagicLink(context.Background(), "a@b.c", "x"); err == nil || !strings.Contains(err.Error(), "could not reach") {
		t.Errorf("unreachable: %v", err)
	}
}

func TestRefreshSessionReturnsTheNewSession(t *testing.T) {
	var calls []seen
	v := projectAnswering(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"access_token":"a2","refresh_token":"r2","token_type":"bearer","expires_in":3600,"expires_at":99}`))
	}, &calls)
	s, err := v.RefreshSession(context.Background(), "r1")
	if err != nil {
		t.Fatal(err)
	}
	if s.AccessToken != "a2" || s.RefreshToken != "r2" || s.ExpiresIn != 3600 || s.ExpiresAt != 99 || s.TokenType != "bearer" {
		t.Errorf("session %+v", s)
	}
	c := calls[0]
	if c.path != "/auth/v1/token" || c.query != "grant_type=refresh_token" || c.body != `{"refresh_token":"r1"}` {
		t.Errorf("request was %+v", c)
	}
}

func TestRefreshSessionRefusals(t *testing.T) {
	var calls []seen
	if _, err := (Verifier{}).RefreshSession(context.Background(), "r"); !errors.Is(err, ErrNoProject) {
		t.Errorf("unconfigured: %v", err)
	}
	ok := projectAnswering(t, status(200), &calls)
	if _, err := ok.RefreshSession(context.Background(), ""); !errors.Is(err, ErrSessionEnded) {
		t.Errorf("empty token: %v", err)
	}
	if len(calls) != 0 {
		t.Errorf("project asked for an empty token")
	}
	for _, code := range []int{400, 401, 403, 404} {
		v := projectAnswering(t, status(code), &calls)
		if _, err := v.RefreshSession(context.Background(), "r"); !errors.Is(err, ErrSessionEnded) {
			t.Errorf("%d: %v", code, err)
		}
	}
	limited := projectAnswering(t, status(429), &calls)
	if _, err := limited.RefreshSession(context.Background(), "r"); !errors.Is(err, ErrRateLimited) {
		t.Errorf("429: %v", err)
	}
	created := projectAnswering(t, status(201), &calls)
	if _, err := created.RefreshSession(context.Background(), "r"); err == nil || !strings.Contains(err.Error(), "201") {
		t.Errorf("non-200 success: %v", err)
	}
	broken := projectAnswering(t, status(500), &calls)
	if _, err := broken.RefreshSession(context.Background(), "r"); err == nil || errors.Is(err, ErrSessionEnded) {
		t.Errorf("500: %v", err)
	}
}

func TestRefreshSessionRefusesAnAnswerMissingEitherToken(t *testing.T) {
	for name, body := range map[string]string{
		"no access":  `{"refresh_token":"r"}`,
		"no refresh": `{"access_token":"a"}`,
		"not json":   `nope`,
	} {
		var calls []seen
		v := projectAnswering(t, func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(body)) }, &calls)
		if _, err := v.RefreshSession(context.Background(), "r"); err == nil || !strings.Contains(err.Error(), "without a session") {
			t.Errorf("%s: %v", name, err)
		}
	}
	down := Verifier{URL: "http://127.0.0.1:1", AnonKey: "a"}
	if _, err := down.RefreshSession(context.Background(), "r"); err == nil || !strings.Contains(err.Error(), "could not reach") {
		t.Errorf("unreachable: %v", err)
	}
}

func TestEndSessionUsesTheCallersTokenAndLogsOutLocally(t *testing.T) {
	var calls []seen
	v := projectAnswering(t, status(204), &calls)
	if err := v.EndSession(context.Background(), "tok"); err != nil {
		t.Fatal(err)
	}
	c := calls[0]
	if c.method != "POST" || c.path != "/auth/v1/logout" || c.query != "scope=local" || c.auth != "Bearer tok" {
		t.Errorf("request was %+v", c)
	}
}

func TestEndSessionRefusals(t *testing.T) {
	var calls []seen
	if err := (Verifier{}).EndSession(context.Background(), "t"); !errors.Is(err, ErrNoProject) {
		t.Errorf("unconfigured: %v", err)
	}
	v := projectAnswering(t, status(204), &calls)
	if err := v.EndSession(context.Background(), ""); !errors.Is(err, ErrSessionEnded) {
		t.Errorf("empty: %v", err)
	}
	if len(calls) != 0 {
		t.Error("project asked for an empty token")
	}
	gone := projectAnswering(t, status(401), &calls)
	if err := gone.EndSession(context.Background(), "t"); !errors.Is(err, ErrSessionEnded) {
		t.Errorf("401: %v", err)
	}
	limited := projectAnswering(t, status(429), &calls)
	if err := limited.EndSession(context.Background(), "t"); !errors.Is(err, ErrRateLimited) {
		t.Errorf("429: %v", err)
	}
	broken := projectAnswering(t, status(503), &calls)
	if err := broken.EndSession(context.Background(), "t"); err == nil || !strings.Contains(err.Error(), "503") {
		t.Errorf("503: %v", err)
	}
	down := Verifier{URL: "http://127.0.0.1:1", AnonKey: "a"}
	if err := down.EndSession(context.Background(), "t"); err == nil || !strings.Contains(err.Error(), "could not reach") {
		t.Errorf("unreachable: %v", err)
	}
}

func TestSessionAnswerMapsEveryClass(t *testing.T) {
	cases := map[int]error{200: nil, 204: nil, 400: ErrSessionEnded, 401: ErrSessionEnded, 403: ErrSessionEnded, 404: ErrSessionEnded, 429: ErrRateLimited}
	for code, want := range cases {
		if got := sessionAnswer(code); !errors.Is(got, want) && got != want {
			t.Errorf("%d: got %v want %v", code, got, want)
		}
	}
	if err := sessionAnswer(500); err == nil || errors.Is(err, ErrSessionEnded) || errors.Is(err, ErrRateLimited) {
		t.Errorf("500: %v", err)
	}
}
