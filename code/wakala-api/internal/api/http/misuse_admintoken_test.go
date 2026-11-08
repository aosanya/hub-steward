package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func getWithHeaders(w stepRunWalk, path, adminToken string, cookie *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if adminToken != "" {
		req.Header.Set("X-Admin-Token", adminToken)
	}
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, req)
	return rec
}

func TestAdminToken_StrangerCannotReachDataRouteWithAdminToken(t *testing.T) {
	w := newStepRunWalk(t, nil)

	dataRoute := "/instances/" + w.instance + "/my-roles"

	refused := getWithHeaders(w, dataRoute, "test-admin-token", nil)
	if refused.Code != http.StatusUnauthorized {
		t.Fatalf("admin token alone on data route %s: got %d %s, want 401", dataRoute, refused.Code, refused.Body.String())
	}

	noCred := getWithHeaders(w, dataRoute, "", nil)
	if noCred.Code != http.StatusUnauthorized {
		t.Fatalf("no credential on data route %s: got %d, want 401", dataRoute, noCred.Code)
	}

	admitted := getWithHeaders(w, dataRoute, "", w.owner)
	if admitted.Code != http.StatusOK {
		t.Fatalf("session holder on data route %s: got %d %s, want 200", dataRoute, admitted.Code, admitted.Body.String())
	}
}
