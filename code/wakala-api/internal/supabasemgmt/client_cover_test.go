package supabasemgmt

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type seen struct {
	method string
	path   string
	auth   string
	ctype  string
	body   string
	user   string
	pass   string
}

func fake(t *testing.T, status int, reply string) (Config, *seen) {
	t.Helper()
	got := &seen{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		got.method = r.Method
		got.path = r.URL.EscapedPath()
		got.auth = r.Header.Get("Authorization")
		got.ctype = r.Header.Get("Content-Type")
		got.body = string(b)
		got.user, got.pass, _ = r.BasicAuth()
		w.WriteHeader(status)
		_, _ = w.Write([]byte(reply))
	}))
	t.Cleanup(srv.Close)
	return Config{ClientID: "cid", ClientSecret: "sec", RedirectURI: "https://app/cb", Base: srv.URL + "/"}, got
}

func TestNewPKCEChallengeIsTheS256OfTheVerifier(t *testing.T) {
	verifier, challenge, err := NewPKCE()
	if err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte(verifier))
	if challenge != base64.RawURLEncoding.EncodeToString(sum[:]) {
		t.Fatalf("challenge %q is not the S256 of the verifier", challenge)
	}
	if len(verifier) < 43 || strings.ContainsAny(verifier, "+/=") {
		t.Fatalf("verifier %q is too short or not URL safe", verifier)
	}
	other, _, _ := NewPKCE()
	if other == verifier {
		t.Fatal("two verifiers were identical")
	}
}

func TestAuthorizeURLCarriesEveryParameterAndTrimsTheBaseSlash(t *testing.T) {
	c := Config{ClientID: "cid", RedirectURI: "https://app/cb?x=1", Base: "http://localhost:9/"}
	raw := c.AuthorizeURL("st ate", "chal")
	if !strings.HasPrefix(raw, "http://localhost:9/v1/oauth/authorize?") {
		t.Fatalf("unexpected url %q", raw)
	}
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{
		"client_id": "cid", "redirect_uri": "https://app/cb?x=1", "response_type": "code",
		"state": "st ate", "code_challenge": "chal", "code_challenge_method": "S256",
	}
	for k, v := range want {
		if u.Query().Get(k) != v {
			t.Fatalf("%s = %q, want %q", k, u.Query().Get(k), v)
		}
	}
}

func TestAuthorizeURLDefaultsToTheProductionHost(t *testing.T) {
	if got := (Config{}).AuthorizeURL("s", "c"); !strings.HasPrefix(got, DefaultBase+"/v1/oauth/authorize?") {
		t.Fatalf("got %q", got)
	}
}

func TestExchangePostsTheCodeWithBasicAuthAndReturnsBothTokens(t *testing.T) {
	c, got := fake(t, 200, `{"access_token":"acc","refresh_token":"ref"}`)
	tok, err := c.Exchange(context.Background(), "the-code", "the-verifier")
	if err != nil {
		t.Fatal(err)
	}
	if tok.Access != "acc" || tok.Refresh != "ref" {
		t.Fatalf("token %+v", tok)
	}
	if got.method != http.MethodPost || got.path != "/v1/oauth/token" {
		t.Fatalf("called %s %s", got.method, got.path)
	}
	if got.user != "cid" || got.pass != "sec" {
		t.Fatalf("basic auth %q %q", got.user, got.pass)
	}
	if got.ctype != "application/x-www-form-urlencoded" {
		t.Fatalf("content type %q", got.ctype)
	}
	form, _ := url.ParseQuery(got.body)
	if form.Get("grant_type") != "authorization_code" || form.Get("code") != "the-code" ||
		form.Get("code_verifier") != "the-verifier" || form.Get("redirect_uri") != "https://app/cb" {
		t.Fatalf("form %v", form)
	}
}

func TestExchangeRefusesAnAnswerWithNoAccessToken(t *testing.T) {
	c, _ := fake(t, 200, `{"refresh_token":"ref"}`)
	_, err := c.Exchange(context.Background(), "c", "v")
	if err == nil || err.Error() != "supabase returned no access token" {
		t.Fatalf("err %v", err)
	}
}

func TestExchangeSurfacesANon2xxAnswerAsATypedError(t *testing.T) {
	c, _ := fake(t, 400, "  invalid_grant\n")
	_, err := c.Exchange(context.Background(), "c", "v")
	var apiErr *Error
	if !errors.As(err, &apiErr) {
		t.Fatalf("err %v is not *Error", err)
	}
	if apiErr.Status != 400 || apiErr.Message != "invalid_grant" {
		t.Fatalf("%+v", apiErr)
	}
	if err.Error() != "supabase answered 400: invalid_grant" {
		t.Fatalf("text %q", err.Error())
	}
}

func TestExchangeMalformedSuccessBodyIsAnError(t *testing.T) {
	c, _ := fake(t, 200, `not json`)
	if _, err := c.Exchange(context.Background(), "c", "v"); err == nil {
		t.Fatal("expected a decode error")
	}
}

func TestAnUnreachableHostSaysSoWithoutLeakingTheAddress(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	base := srv.URL
	srv.Close()
	c := Config{Base: base}
	_, err := c.Exchange(context.Background(), "c", "v")
	if err == nil || err.Error() != "could not reach Supabase" {
		t.Fatalf("err %v", err)
	}
}

func TestACancelledContextIsReportedAsUnreachable(t *testing.T) {
	c, _ := fake(t, 200, `{}`)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := c.Revoke(ctx, "r"); err == nil || err.Error() != "could not reach Supabase" {
		t.Fatalf("err %v", err)
	}
}

func TestRevokeSendsTheCredentialsAsJSON(t *testing.T) {
	c, got := fake(t, 204, "")
	if err := c.Revoke(context.Background(), "refresh-1"); err != nil {
		t.Fatal(err)
	}
	if got.method != http.MethodPost || got.path != "/v1/oauth/revoke" || got.ctype != "application/json" {
		t.Fatalf("%+v", got)
	}
	var body map[string]string
	if err := json.Unmarshal([]byte(got.body), &body); err != nil {
		t.Fatal(err)
	}
	if body["client_id"] != "cid" || body["client_secret"] != "sec" || body["refresh_token"] != "refresh-1" {
		t.Fatalf("body %v", body)
	}
}

func TestRevokeReportsARefusal(t *testing.T) {
	c, _ := fake(t, 401, "nope")
	var apiErr *Error
	if err := c.Revoke(context.Background(), "r"); !errors.As(err, &apiErr) || apiErr.Status != 401 {
		t.Fatalf("err %v", err)
	}
}

func TestSessionCallsCarryTheBearerTokenOfTheirOwner(t *testing.T) {
	c, got := fake(t, 200, `[{"id":"o1","name":"Acme","slug":"acme"}]`)
	orgs, err := c.For("tok-9").Orgs(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(orgs) != 1 || orgs[0] != (Org{ID: "o1", Name: "Acme", Slug: "acme"}) {
		t.Fatalf("orgs %+v", orgs)
	}
	if got.auth != "Bearer tok-9" || got.method != http.MethodGet || got.path != "/v1/organizations" {
		t.Fatalf("%+v", got)
	}
	if got.ctype != "" {
		t.Fatalf("a bodiless call set content type %q", got.ctype)
	}
}

func TestProjectsDecodesTheProjectFieldsByTheirWireNames(t *testing.T) {
	c, got := fake(t, 200, `[{"id":"abc","name":"P","organization_id":"o1","region":"eu","status":"ACTIVE_HEALTHY"}]`)
	ps, err := c.For("t").Projects(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	want := Project{Ref: "abc", Name: "P", Org: "o1", Region: "eu", Status: "ACTIVE_HEALTHY"}
	if len(ps) != 1 || ps[0] != want || got.path != "/v1/projects" {
		t.Fatalf("%+v %s", ps, got.path)
	}
}

func TestCreateProjectPostsTheFourFieldsAsJSON(t *testing.T) {
	c, got := fake(t, 201, `{"id":"newref","name":"N","status":"COMING_UP"}`)
	p, err := c.For("t").CreateProject(context.Background(), "N", "acme", "eu-west-1", "pw")
	if err != nil {
		t.Fatal(err)
	}
	if p.Ref != "newref" || p.Status != "COMING_UP" {
		t.Fatalf("%+v", p)
	}
	var body map[string]string
	_ = json.Unmarshal([]byte(got.body), &body)
	want := map[string]string{"name": "N", "organization_slug": "acme", "region": "eu-west-1", "db_pass": "pw"}
	for k, v := range want {
		if body[k] != v {
			t.Fatalf("%s = %q", k, body[k])
		}
	}
	if got.ctype != "application/json" || got.method != http.MethodPost {
		t.Fatalf("%+v", got)
	}
}

func TestProjectRefIsPathEscaped(t *testing.T) {
	c, got := fake(t, 200, `{"id":"x"}`)
	if _, err := c.For("t").Project(context.Background(), "a/b c"); err != nil {
		t.Fatal(err)
	}
	if got.path != "/v1/projects/a%2Fb%20c" {
		t.Fatalf("path %q", got.path)
	}
}

func TestQuerySendsTheStatementAndIgnoresAnEmptyAnswer(t *testing.T) {
	c, got := fake(t, 201, "")
	if err := c.For("t").Query(context.Background(), "ref/1", "select 1"); err != nil {
		t.Fatal(err)
	}
	if got.path != "/v1/projects/ref%2F1/database/query" || got.body != `{"query":"select 1"}` {
		t.Fatalf("%+v", got)
	}
}

func TestQueryReportsTheDatabaseErrorText(t *testing.T) {
	c, _ := fake(t, 400, `{"message":"syntax error"}`)
	err := c.For("t").Query(context.Background(), "r", "selec")
	var apiErr *Error
	if !errors.As(err, &apiErr) || apiErr.Status != 400 || !strings.Contains(apiErr.Message, "syntax error") {
		t.Fatalf("err %v", err)
	}
}

func TestRestrictNetworkSendsTheAllowedCidrs(t *testing.T) {
	c, got := fake(t, 201, "")
	if err := c.For("t").RestrictNetwork(context.Background(), "r1", []string{"1.2.3.4/32", "10.0.0.0/8"}); err != nil {
		t.Fatal(err)
	}
	if got.path != "/v1/projects/r1/network-restrictions/apply" {
		t.Fatalf("path %q", got.path)
	}
	var body struct {
		Cidrs []string `json:"dbAllowedCidrs"`
	}
	_ = json.Unmarshal([]byte(got.body), &body)
	if len(body.Cidrs) != 2 || body.Cidrs[0] != "1.2.3.4/32" || body.Cidrs[1] != "10.0.0.0/8" {
		t.Fatalf("body %s", got.body)
	}
}

func TestAnonKeyPicksTheAnonKeyAndNeverTheServiceRoleKey(t *testing.T) {
	c, got := fake(t, 200, `[{"name":"service_role","api_key":"SECRET"},{"name":"anon","api_key":"PUBLIC"}]`)
	key, err := c.For("t").AnonKey(context.Background(), "r1")
	if err != nil {
		t.Fatal(err)
	}
	if key != "PUBLIC" || got.path != "/v1/projects/r1/api-keys" {
		t.Fatalf("key %q path %q", key, got.path)
	}
}

func TestAnonKeyRefusesWhenOnlyTheServiceRoleKeyIsListed(t *testing.T) {
	c, _ := fake(t, 200, `[{"name":"service_role","api_key":"SECRET"}]`)
	key, err := c.For("t").AnonKey(context.Background(), "r1")
	if key != "" || err == nil || strings.Contains(err.Error(), "SECRET") {
		t.Fatalf("key %q err %v", key, err)
	}
}

func TestAnonKeyPassesOnALookupFailure(t *testing.T) {
	c, _ := fake(t, 403, "forbidden")
	if _, err := c.For("t").AnonKey(context.Background(), "r1"); err == nil {
		t.Fatal("expected an error")
	}
}

func scripted(t *testing.T, statuses ...string) (*Session, *int32) {
	t.Helper()
	var n int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		i := int(atomic.AddInt32(&n, 1)) - 1
		if i >= len(statuses) {
			i = len(statuses) - 1
		}
		_, _ = w.Write([]byte(`{"id":"r","status":"` + statuses[i] + `"}`))
	}))
	t.Cleanup(srv.Close)
	return Config{Base: srv.URL}.For("t"), &n
}

func TestReadyPollsUntilHealthyAndReportsEveryStatusSeen(t *testing.T) {
	s, calls := scripted(t, "COMING_UP", "UNKNOWN", "ACTIVE_HEALTHY")
	var seenStatuses []string
	err := s.Ready(context.Background(), "r", time.Millisecond, func(st string) { seenStatuses = append(seenStatuses, st) })
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(seenStatuses, ",") != "COMING_UP,UNKNOWN,ACTIVE_HEALTHY" || atomic.LoadInt32(calls) != 3 {
		t.Fatalf("statuses %v calls %d", seenStatuses, atomic.LoadInt32(calls))
	}
}

func TestReadyStopsAtOnceOnATerminalFailureStatus(t *testing.T) {
	for _, status := range []string{"INIT_FAILED", "REMOVED", "GOING_DOWN"} {
		s, calls := scripted(t, status, "ACTIVE_HEALTHY")
		err := s.Ready(context.Background(), "ref9", time.Millisecond, nil)
		if err == nil || err.Error() != "project ref9 is "+status {
			t.Fatalf("%s: err %v", status, err)
		}
		if atomic.LoadInt32(calls) != 1 {
			t.Fatalf("%s: polled %d times", status, atomic.LoadInt32(calls))
		}
	}
}

func TestReadyGivesUpWhenTheContextEnds(t *testing.T) {
	s, _ := scripted(t, "COMING_UP")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	err := s.Ready(ctx, "r", time.Hour, nil)
	if err == nil {
		t.Fatal("expected the context error")
	}
}

func TestReadyPassesOnAProjectLookupFailure(t *testing.T) {
	c, _ := fake(t, 500, "boom")
	var apiErr *Error
	if err := c.For("t").Ready(context.Background(), "r", time.Millisecond, nil); !errors.As(err, &apiErr) || apiErr.Status != 500 {
		t.Fatalf("err %v", err)
	}
}
