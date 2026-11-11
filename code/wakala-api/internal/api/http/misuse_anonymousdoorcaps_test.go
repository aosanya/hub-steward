package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

type anonymousDoorCase struct {
	name  string
	path  string
	limit int
}

func anonymousDoorCases(instance string) []anonymousDoorCase {
	publicLinks := "/instances/" + instance + "/forms/public-links/some-key"
	return []anonymousDoorCase{
		{"form respondent registration", publicLinks + "/respondents", anonymousFormBodyBytes},
		{"form declaration", publicLinks + "/declarations", anonymousFormBodyBytes},
		{"report filing", "/reports/suggestions", anonymousReportBodyBytes},
		{"report page view", "/reports/page-views", anonymousJSONBodyBytes},
		{"magic link request", "/auth/magic-link", anonymousJSONBodyBytes},
		{"operator sign-in", "/auth/signin", anonymousJSONBodyBytes},
		{"session refresh", "/auth/refresh", anonymousJSONBodyBytes},
	}
}

func jsonBodyOfLength(total int) string {
	const head, tail = `{"note":"`, `"}`
	return head + strings.Repeat("a", total-len(head)-len(tail)) + tail
}

func anonymousWalkWithReports(t *testing.T) stepRunWalk {
	t.Helper()
	w := newStepRunWalk(t, nil)
	rdb := gateTestDB(t, "doorcaps")
	rs, err := catalog.SpecFor("doorcaps", "")
	if err != nil {
		t.Fatalf("catalog SpecFor: %v", err)
	}
	if err := spec.Migrate(rdb, rs); err != nil {
		t.Fatalf("catalog Migrate: %v", err)
	}
	cm, err := catalog.NewCatalogManager(rdb, rs)
	if err != nil {
		t.Fatalf("NewCatalogManager: %v", err)
	}
	w.deps.Reports = cm
	w.handler = NewRouter(w.deps)
	return w
}

func postAnonymously(w stepRunWalk, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("POST", path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, req)
	return rec
}

func TestAnonymousDoorCaps_EachDoorAnswersAtItsOwnLimit(t *testing.T) {
	w := anonymousWalkWithReports(t)
	for _, door := range anonymousDoorCases(w.instance) {
		for _, size := range []int{1024, door.limit - 1, door.limit} {
			rec := postAnonymously(w, door.path, jsonBodyOfLength(size))
			if rec.Code == http.StatusRequestEntityTooLarge {
				t.Errorf("%s with %d bytes (limit %d): %d %s, want the door to read it", door.name, size, door.limit, rec.Code, rec.Body.String())
			}
		}
	}
}

func TestAnonymousDoorCaps_EachDoorRefusesJustOverItsOwnLimit(t *testing.T) {
	w := anonymousWalkWithReports(t)
	for _, door := range anonymousDoorCases(w.instance) {
		for _, size := range []int{door.limit + 1, 2 * door.limit} {
			rec := postAnonymously(w, door.path, jsonBodyOfLength(size))
			if rec.Code != http.StatusRequestEntityTooLarge {
				t.Errorf("%s with %d bytes (limit %d): %d %s, want 413", door.name, size, door.limit, rec.Code, rec.Body.String())
			}
		}
	}
}

func TestAnonymousDoorCaps_TheScanAdmitsWhatTheWidestDoorAdmits(t *testing.T) {
	for _, door := range anonymousDoorCases("i") {
		if door.limit > anonymousJSONBodyBytes {
			t.Errorf("%s admits %d bytes but the anonymous scan stops at %d, so raising the door would be undone", door.name, door.limit, anonymousJSONBodyBytes)
		}
	}
	for _, widest := range []int{anonymousFormBodyBytes, anonymousReportBodyBytes} {
		if anonymousJSONBodyBytes < widest {
			t.Errorf("anonymous scan cap %d is below a door cap %d", anonymousJSONBodyBytes, widest)
		}
	}
}

func TestAnonymousDoorCaps_ABodyThatNeedsMoreThanTheCapBelongsToASignedInRoute(t *testing.T) {
	w := anonymousWalkWithReports(t)
	over := jsonBodyOfLength(anonymousJSONBodyBytes - 1024)
	routes := map[string]string{
		"join request":        "/instances/" + w.instance + "/actor/groups/some-group/join",
		"form answer":         "/instances/" + w.instance + "/forms/forms/some-form/answers",
		"share-link register": "/instances/" + w.instance + "/invitations",
	}
	for name, path := range routes {
		rec := postAnonymously(w, path, over)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s without a credential: %d %s, want 401 (a door that asks for sign-in needs no anonymous allowance)", name, rec.Code, rec.Body.String())
		}
	}
}
