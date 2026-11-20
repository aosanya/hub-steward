package http

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

func studioNext(reached *bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*reached = true
		w.WriteHeader(http.StatusTeapot)
	})
}

func TestStudioOriginsFromCanonicalisesAndSeparatesRejected(t *testing.T) {
	origins, rejected := StudioOriginsFrom(" https://Console.Example.org/ , http://localhost:5173,,ftp://files.example.org,https://a.example.org/path,https://user@b.example.org,not a url ")
	wantOrigins := []string{"https://console.example.org", "http://localhost:5173"}
	if !reflect.DeepEqual(origins, wantOrigins) {
		t.Fatalf("origins = %v, want %v", origins, wantOrigins)
	}
	wantRejected := []string{"ftp://files.example.org", "https://a.example.org/path", "https://user@b.example.org", "not a url"}
	if !reflect.DeepEqual(rejected, wantRejected) {
		t.Fatalf("rejected = %v, want %v", rejected, wantRejected)
	}
}

func TestStudioOriginsFromEmptyListGivesNothing(t *testing.T) {
	origins, rejected := StudioOriginsFrom("  , ,")
	if len(origins) != 0 || len(rejected) != 0 {
		t.Fatalf("origins = %v, rejected = %v, want none", origins, rejected)
	}
}

func TestOriginsOverlapKeepsOrderOfFirstList(t *testing.T) {
	shared := OriginsOverlap([]string{"https://c", "https://a", "https://b"}, []string{"https://b", "https://c", "https://z"})
	if want := []string{"https://c", "https://b"}; !reflect.DeepEqual(shared, want) {
		t.Fatalf("shared = %v, want %v", shared, want)
	}
	if got := OriginsOverlap([]string{"https://a"}, nil); len(got) != 0 {
		t.Fatalf("overlap with nothing = %v, want none", got)
	}
}

func TestCheckedStudioOriginsRefusesAnOriginAlsoGrantedToMembers(t *testing.T) {
	origins, rejected, err := CheckedStudioOrigins("https://console.example.org, https://app.example.org, bogus", []string{"https://app.example.org"})
	if err == nil {
		t.Fatal("want an error when an origin is in both lists")
	}
	if origins != nil {
		t.Fatalf("origins = %v, want nil on refusal", origins)
	}
	if !reflect.DeepEqual(rejected, []string{"bogus"}) {
		t.Fatalf("rejected = %v, want the unparseable entry still reported", rejected)
	}
	for _, part := range []string{"STUDIO_ORIGINS", "MEMBER_APP_ORIGINS", "https://app.example.org"} {
		if !strings.Contains(err.Error(), part) {
			t.Fatalf("error %q does not name %q", err, part)
		}
	}
	if strings.Contains(err.Error(), "console.example.org") {
		t.Fatalf("error %q names an origin that is not shared", err)
	}
}

func TestCheckedStudioOriginsAcceptsDisjointLists(t *testing.T) {
	origins, _, err := CheckedStudioOrigins("https://console.example.org", []string{"https://app.example.org"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !reflect.DeepEqual(origins, []string{"https://console.example.org"}) {
		t.Fatalf("origins = %v", origins)
	}
}

func TestAllowStudioOriginsWithNoUsableOriginReturnsNextUnchanged(t *testing.T) {
	var reached bool
	next := studioNext(&reached)
	handler := allowStudioOrigins([]string{""}, next)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("Origin", "")
	handler.ServeHTTP(rec, req)
	if !reached || rec.Code != http.StatusTeapot {
		t.Fatalf("reached = %v, code = %d", reached, rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("no origin was configured so none may be allowed")
	}
}

func TestAllowStudioOriginsAnswersAPreflightFromAnAllowedOrigin(t *testing.T) {
	var reached bool
	handler := allowStudioOrigins([]string{"https://console.example.org"}, studioNext(&reached))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/mcp", nil)
	req.Header.Set("Origin", "https://console.example.org")
	req.Header.Set("Access-Control-Request-Method", "POST")
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("code = %d, want 204", rec.Code)
	}
	if reached {
		t.Fatal("a preflight must not reach the wrapped handler")
	}
	h := rec.Header()
	want := map[string]string{
		"Access-Control-Allow-Origin":      "https://console.example.org",
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Allow-Methods":     studioAllowedMethods,
		"Access-Control-Allow-Headers":     studioAllowedHeaders,
		"Access-Control-Max-Age":           "600",
	}
	for k, v := range want {
		if got := h.Get(k); got != v {
			t.Errorf("%s = %q, want %q", k, got, v)
		}
	}
	if !strings.Contains(h.Get("Access-Control-Allow-Headers"), "Mcp-Session-Id") {
		t.Error("preflight must allow the MCP session header")
	}
	if !strings.Contains(strings.Join(h.Values("Vary"), ","), "Origin") {
		t.Error("response must vary on Origin")
	}
}

func TestAllowStudioOriginsExposesHeadersOnARealRequestAndPassesItOn(t *testing.T) {
	var reached bool
	handler := allowStudioOrigins([]string{"https://console.example.org"}, studioNext(&reached))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/mcp", nil)
	req.Header.Set("Origin", "https://console.example.org")
	handler.ServeHTTP(rec, req)
	if !reached || rec.Code != http.StatusTeapot {
		t.Fatalf("reached = %v, code = %d", reached, rec.Code)
	}
	h := rec.Header()
	if h.Get("Access-Control-Allow-Origin") != "https://console.example.org" || h.Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("allow headers missing: %v", h)
	}
	if h.Get("Access-Control-Expose-Headers") != studioExposedHeaders {
		t.Fatalf("expose = %q", h.Get("Access-Control-Expose-Headers"))
	}
	if h.Get("Access-Control-Allow-Methods") != "" {
		t.Fatal("a non-preflight response must not carry the preflight headers")
	}
}

func TestAllowStudioOriginsTreatsOptionsWithoutRequestMethodAsAnOrdinaryRequest(t *testing.T) {
	var reached bool
	handler := allowStudioOrigins([]string{"https://console.example.org"}, studioNext(&reached))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/mcp", nil)
	req.Header.Set("Origin", "https://console.example.org")
	handler.ServeHTTP(rec, req)
	if !reached || rec.Code != http.StatusTeapot {
		t.Fatalf("reached = %v, code = %d", reached, rec.Code)
	}
}

func TestAllowStudioOriginsLeavesAForeignOriginUntouched(t *testing.T) {
	for _, origin := range []string{"https://evil.example.org", "https://console.example.org.evil.org", "HTTPS://CONSOLE.EXAMPLE.ORG", ""} {
		var reached bool
		handler := allowStudioOrigins([]string{"https://console.example.org"}, studioNext(&reached))
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodOptions, "/mcp", nil)
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		req.Header.Set("Access-Control-Request-Method", "POST")
		handler.ServeHTTP(rec, req)
		if !reached || rec.Code != http.StatusTeapot {
			t.Errorf("origin %q: reached = %v, code = %d", origin, reached, rec.Code)
		}
		for k := range rec.Header() {
			if strings.HasPrefix(k, "Access-Control-") {
				t.Errorf("origin %q got %s", origin, k)
			}
		}
	}
}
