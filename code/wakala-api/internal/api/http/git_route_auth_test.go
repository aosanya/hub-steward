package http

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/apikeys"
)

const (
	cloneRefsPath  = "/git/farm/harvest.git/info/refs?service=git-upload-pack"
	pushRefsPath   = "/git/farm/harvest.git/info/refs?service=git-receive-pack"
	clonePackPath  = "/git/farm/harvest.git/git-upload-pack"
	pushPackPath   = "/git/farm/harvest.git/git-receive-pack"
	readerToken    = "wak_reader.secret"
	writerToken    = "wak_writer.secret"
	revokedToken   = "wak_revoked.secret"
	strangerToken  = "wak_stranger.secret"
	otherAgencyKey = "wak_pinned.secret"
)

type fakeGitBackend struct {
	keys         map[string]apikeys.Key
	access       map[string]gitAccess
	repositories map[string]bool
}

func (f fakeGitBackend) signIn(_ context.Context, token string) (apikeys.Key, bool) {
	key, ok := f.keys[token]
	return key, ok
}

func (f fakeGitBackend) accessIn(_ context.Context, agency, account string) (gitAccess, error) {
	if agency != "farm" {
		return gitAccess{}, agencies.ErrInstanceNotFound
	}
	return f.access[account], nil
}

func (f fakeGitBackend) hasRepository(_ context.Context, agency, repository string) (bool, error) {
	return f.repositories[agency+"/"+repository], nil
}

func newFakeGitBackend() fakeGitBackend {
	return fakeGitBackend{
		keys: map[string]apikeys.Key{
			readerToken:    {ID: "reader", AccountID: "reader-account"},
			writerToken:    {ID: "writer", AccountID: "writer-account"},
			strangerToken:  {ID: "stranger", AccountID: "stranger-account"},
			otherAgencyKey: {ID: "pinned", AccountID: "writer-account", InstanceID: "elsewhere"},
		},
		access: map[string]gitAccess{
			"reader-account": {read: true},
			"writer-account": {read: true, write: true},
		},
		repositories: map[string]bool{"farm/harvest": true},
	}
}

type reachedHandler struct {
	called  int
	account string
}

func (h *reachedHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.called++
	h.account = accounts.IDFromContext(r.Context())
	w.WriteHeader(http.StatusTeapot)
}

func gitRequest(method, path string, headers map[string]string) *http.Request {
	r := httptest.NewRequest(method, path, strings.NewReader(""))
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	return r
}

func basic(user, password string) map[string]string {
	return map[string]string{"Authorization": "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+password))}
}

func bearer(token string) map[string]string {
	return map[string]string{"Authorization": "Bearer " + token}
}

func serveGit(backend gitRouteBackend, r *http.Request) (*httptest.ResponseRecorder, *reachedHandler) {
	reached := &reachedHandler{}
	rec := httptest.NewRecorder()
	gitRouteAuth(backend, reached).ServeHTTP(rec, r)
	return rec, reached
}

func TestGitRouteAuth_NoCredentialsAnswers401WithABasicChallenge(t *testing.T) {
	rec, reached := serveGit(newFakeGitBackend(), gitRequest("GET", cloneRefsPath, nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("no credentials = %d, want 401", rec.Code)
	}
	if got := rec.Header().Get("WWW-Authenticate"); got != `Basic realm="hub"` {
		t.Fatalf("challenge = %q, want Basic realm=\"hub\"", got)
	}
	if reached.called != 0 {
		t.Fatal("the wrapped handler ran with no credentials")
	}
}

func TestGitRouteAuth_AWrongKeyAnswers401WithABasicChallenge(t *testing.T) {
	for name, headers := range map[string]map[string]string{
		"basic":  basic("anyone", "wak_nobody.wrong"),
		"bearer": bearer("wak_nobody.wrong"),
	} {
		t.Run(name, func(t *testing.T) {
			rec, reached := serveGit(newFakeGitBackend(), gitRequest("GET", cloneRefsPath, headers))
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("wrong key = %d, want 401", rec.Code)
			}
			if rec.Header().Get("WWW-Authenticate") != `Basic realm="hub"` {
				t.Fatalf("challenge = %q", rec.Header().Get("WWW-Authenticate"))
			}
			if reached.called != 0 {
				t.Fatal("the wrapped handler ran with a wrong key")
			}
		})
	}
}

func TestGitRouteAuth_TheSessionCookieIsNotACredential(t *testing.T) {
	r := gitRequest("GET", cloneRefsPath, nil)
	r.AddCookie(&http.Cookie{Name: sessionCookieName, Value: writerToken})
	rec, reached := serveGit(newFakeGitBackend(), r)
	if rec.Code != http.StatusUnauthorized || reached.called != 0 {
		t.Fatalf("cookie only = %d reached=%d, want 401 and not reached", rec.Code, reached.called)
	}
}

func TestGitRouteAuth_TheUserNameIsIgnored(t *testing.T) {
	for _, user := range []string{"", "x", "writer", "someone-else"} {
		rec, reached := serveGit(newFakeGitBackend(), gitRequest("GET", pushRefsPath, basic(user, writerToken)))
		if rec.Code != http.StatusTeapot || reached.called != 1 {
			t.Fatalf("user %q = %d reached=%d, want the wrapped handler", user, rec.Code, reached.called)
		}
	}
}

func TestGitRouteAuth_AReaderMayCloneButNotPush(t *testing.T) {
	backend := newFakeGitBackend()
	cases := []struct {
		name, method, path string
		want               int
	}{
		{"clone advertisement", "GET", cloneRefsPath, http.StatusTeapot},
		{"clone pack", "POST", clonePackPath, http.StatusTeapot},
		{"push advertisement", "GET", pushRefsPath, http.StatusForbidden},
		{"push pack", "POST", pushPackPath, http.StatusForbidden},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec, reached := serveGit(backend, gitRequest(c.method, c.path, basic("me", readerToken)))
			if rec.Code != c.want {
				t.Fatalf("%s %s = %d, want %d", c.method, c.path, rec.Code, c.want)
			}
			if (c.want == http.StatusTeapot) != (reached.called == 1) {
				t.Fatalf("wrapped handler called %d times for status %d", reached.called, rec.Code)
			}
		})
	}
}

func TestGitRouteAuth_AWriterPushesThroughToTheWrappedHandler(t *testing.T) {
	for _, c := range []struct{ method, path string }{
		{"GET", pushRefsPath}, {"POST", pushPackPath}, {"GET", cloneRefsPath}, {"POST", clonePackPath},
	} {
		rec, reached := serveGit(newFakeGitBackend(), gitRequest(c.method, c.path, basic("me", writerToken)))
		if rec.Code != http.StatusTeapot || reached.called != 1 {
			t.Fatalf("%s %s = %d reached=%d, want the wrapped handler", c.method, c.path, rec.Code, reached.called)
		}
		if reached.account != "writer-account" {
			t.Fatalf("wrapped handler saw caller %q, want writer-account", reached.account)
		}
	}
}

func TestGitRouteAuth_BearerIsAcceptedAsWellAsBasic(t *testing.T) {
	rec, reached := serveGit(newFakeGitBackend(), gitRequest("POST", pushPackPath, bearer(writerToken)))
	if rec.Code != http.StatusTeapot || reached.called != 1 {
		t.Fatalf("bearer push = %d reached=%d", rec.Code, reached.called)
	}
}

func TestGitRouteAuth_UnknownNamesAnswer404LikeNoAccess(t *testing.T) {
	cases := map[string]string{
		"unknown agency":     "/git/nowhere/harvest.git/info/refs?service=git-upload-pack",
		"unknown repository": "/git/farm/missing.git/info/refs?service=git-upload-pack",
		"no .git suffix":     "/git/farm/missing/info/refs?service=git-upload-pack",
		"unknown endpoint":   "/git/farm/harvest.git/objects/info/packs",
		"no repository":      "/git/farm",
	}
	for name, path := range cases {
		t.Run(name, func(t *testing.T) {
			rec, reached := serveGit(newFakeGitBackend(), gitRequest("GET", path, basic("me", writerToken)))
			if rec.Code != http.StatusNotFound || reached.called != 0 {
				t.Fatalf("GET %s = %d reached=%d, want 404", path, rec.Code, reached.called)
			}
		})
	}
}

func TestGitRouteAuth_ACallerWithNoAccessSeesTheSame404ForARealAndAnUnknownRepository(t *testing.T) {
	real, _ := serveGit(newFakeGitBackend(), gitRequest("GET", cloneRefsPath, basic("me", strangerToken)))
	unknown, _ := serveGit(newFakeGitBackend(), gitRequest("GET", "/git/farm/missing.git/info/refs?service=git-upload-pack", basic("me", strangerToken)))
	if real.Code != http.StatusNotFound || unknown.Code != http.StatusNotFound {
		t.Fatalf("stranger got %d and %d, want 404 for both", real.Code, unknown.Code)
	}
	if real.Body.String() != unknown.Body.String() {
		t.Fatalf("bodies differ: %q vs %q", real.Body.String(), unknown.Body.String())
	}
	pushing, _ := serveGit(newFakeGitBackend(), gitRequest("POST", pushPackPath, basic("me", strangerToken)))
	if pushing.Code != http.StatusNotFound {
		t.Fatalf("stranger pushing = %d, want 404", pushing.Code)
	}
}

func TestGitRouteAuth_AKeyPinnedToAnotherAgencyIsTreatedAsNoAccess(t *testing.T) {
	rec, reached := serveGit(newFakeGitBackend(), gitRequest("POST", pushPackPath, basic("me", otherAgencyKey)))
	if rec.Code != http.StatusNotFound || reached.called != 0 {
		t.Fatalf("pinned key = %d reached=%d, want 404", rec.Code, reached.called)
	}
}

func TestGitRouteAuth_OtherMethodsAreRefused(t *testing.T) {
	for _, c := range []struct{ method, path string }{
		{"POST", cloneRefsPath}, {"GET", clonePackPath}, {"PUT", pushPackPath}, {"DELETE", cloneRefsPath},
	} {
		rec, reached := serveGit(newFakeGitBackend(), gitRequest(c.method, c.path, basic("me", writerToken)))
		if rec.Code != http.StatusMethodNotAllowed || reached.called != 0 {
			t.Fatalf("%s %s = %d reached=%d, want 405", c.method, c.path, rec.Code, reached.called)
		}
	}
}

func TestGitRouteAuth_AnAdvertisementForNoServiceIsRefused(t *testing.T) {
	rec, reached := serveGit(newFakeGitBackend(), gitRequest("GET", "/git/farm/harvest.git/info/refs", basic("me", writerToken)))
	if rec.Code != http.StatusNotFound || reached.called != 0 {
		t.Fatalf("dumb advertisement = %d reached=%d, want 404", rec.Code, reached.called)
	}
}

type liveGitRoute struct {
	walk    stepRunWalk
	handler http.Handler
	reached *reachedHandler
}

func newLiveGitRoute(t *testing.T) liveGitRoute {
	t.Helper()
	walk := newStepRunWalk(t, nil)
	keys, err := apikeys.NewManager(walk.db)
	if err != nil {
		t.Fatal(err)
	}
	walk.deps.APIKeys = keys
	runsModules(t, walk.instance, "git")
	rec := walk.call(t, "POST", "/instances/"+walk.instance+"/forms-git/repos", map[string]any{"name": "harvest"}, walk.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create repository: %d %s", rec.Code, rec.Body.String())
	}
	reached := &reachedHandler{}
	return liveGitRoute{walk: walk, handler: walk.deps.GitRouteAuth(reached), reached: reached}
}

func (l liveGitRoute) mint(t *testing.T, account string) (apikeys.Key, string) {
	t.Helper()
	key, token, err := l.walk.deps.APIKeys.Create(accounts.WithID(context.Background(), account), "git")
	if err != nil {
		t.Fatal(err)
	}
	return key, token
}

func (l liveGitRoute) serve(method, path, token string) *httptest.ResponseRecorder {
	l.reached.called = 0
	rec := httptest.NewRecorder()
	l.handler.ServeHTTP(rec, gitRequest(method, path, basic("me", token)))
	return rec
}

func (l liveGitRoute) path(repository, suffix string) string {
	return "/git/" + l.walk.instance + "/" + repository + ".git" + suffix
}

func TestGitRouteAuth_TheOwnersKeyClonesAndPushesInTheirAgency(t *testing.T) {
	l := newLiveGitRoute(t)
	_, token := l.mint(t, "test-owner")
	for _, c := range []struct{ method, suffix string }{
		{"GET", "/info/refs?service=git-upload-pack"}, {"POST", "/git-upload-pack"},
		{"GET", "/info/refs?service=git-receive-pack"}, {"POST", "/git-receive-pack"},
	} {
		rec := l.serve(c.method, l.path("harvest", c.suffix), token)
		if rec.Code != http.StatusTeapot || l.reached.called != 1 {
			t.Fatalf("owner %s %s = %d reached=%d", c.method, c.suffix, rec.Code, l.reached.called)
		}
	}
}

func TestGitRouteAuth_ARevokedKeyIsRefusedOnTheNextRequest(t *testing.T) {
	l := newLiveGitRoute(t)
	key, token := l.mint(t, "test-owner")
	path := l.path("harvest", "/info/refs?service=git-upload-pack")
	if rec := l.serve("GET", path, token); rec.Code != http.StatusTeapot {
		t.Fatalf("live key = %d, want the wrapped handler", rec.Code)
	}
	if err := l.walk.deps.APIKeys.Revoke(accounts.WithID(context.Background(), "test-owner"), key.ID); err != nil {
		t.Fatal(err)
	}
	rec := l.serve("GET", path, token)
	if rec.Code != http.StatusUnauthorized || rec.Header().Get("WWW-Authenticate") != `Basic realm="hub"` || l.reached.called != 0 {
		t.Fatalf("revoked key = %d challenge=%q reached=%d, want 401 with challenge", rec.Code, rec.Header().Get("WWW-Authenticate"), l.reached.called)
	}
}

func TestGitRouteAuth_APersonOutsideTheAgencyIsTold404(t *testing.T) {
	l := newLiveGitRoute(t)
	_, token := l.mint(t, "someone-outside")
	for _, repository := range []string{"harvest", "missing"} {
		rec := l.serve("GET", l.path(repository, "/info/refs?service=git-upload-pack"), token)
		if rec.Code != http.StatusNotFound || l.reached.called != 0 {
			t.Fatalf("outsider on %s = %d reached=%d, want 404", repository, rec.Code, l.reached.called)
		}
	}
}

func TestGitRouteAuth_AResidentOfTheAgencyHasNoGitAccess(t *testing.T) {
	l := newLiveGitRoute(t)
	if err := l.walk.deps.Registry.AddMember(context.Background(), l.walk.instance, "a-resident", agencies.RoleResident); err != nil {
		t.Fatal(err)
	}
	_, token := l.mint(t, "a-resident")
	rec := l.serve("GET", l.path("harvest", "/info/refs?service=git-upload-pack"), token)
	if rec.Code != http.StatusNotFound || l.reached.called != 0 {
		t.Fatalf("resident = %d reached=%d, want 404", rec.Code, l.reached.called)
	}
}

func TestGitRouteAuth_AnUnknownAgencyAndAnUnknownRepositoryAre404ForTheOwnerToo(t *testing.T) {
	l := newLiveGitRoute(t)
	_, token := l.mint(t, "test-owner")
	for name, path := range map[string]string{
		"repository": l.path("missing", "/info/refs?service=git-upload-pack"),
		"agency":     "/git/not-an-agency/harvest.git/info/refs?service=git-upload-pack",
	} {
		if rec := l.serve("GET", path, token); rec.Code != http.StatusNotFound || l.reached.called != 0 {
			t.Fatalf("unknown %s = %d reached=%d, want 404", name, rec.Code, l.reached.called)
		}
	}
}

func TestGitRouteAuth_AnAgencyWithoutTheGitModuleAnswers404(t *testing.T) {
	l := newLiveGitRoute(t)
	runsModules(t, l.walk.instance, "forms")
	_, token := l.mint(t, "test-owner")
	rec := l.serve("GET", l.path("harvest", "/info/refs?service=git-upload-pack"), token)
	if rec.Code != http.StatusNotFound || l.reached.called != 0 {
		t.Fatalf("git unmounted = %d reached=%d, want 404", rec.Code, l.reached.called)
	}
}
