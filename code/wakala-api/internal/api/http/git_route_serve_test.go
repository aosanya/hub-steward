package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"wakalaserver/internal/agencies"
	mwanachamagit "wakalaserver/modules/git"
)

type servingManager struct {
	mwanachamagit.GitManager
	seen *string
}

func (s servingManager) SmartHTTPHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*s.seen = r.URL.Path
		w.WriteHeader(http.StatusNoContent)
	})
}

type servingRegistry struct {
	agencies.Registry
	seen *string
}

func (s servingRegistry) GitManager(_ context.Context, id string) (mwanachamagit.GitManager, error) {
	if id != "farm" {
		return nil, agencies.ErrInstanceNotFound
	}
	return servingManager{seen: s.seen}, nil
}

func TestGitRoute_HandsTheAgencysManagerThePathBelowTheAgency(t *testing.T) {
	var seen string
	handler := (&Deps{Registry: servingRegistry{seen: &seen}}).GitRoute()

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/git/farm/harvest.git/info/refs?service=git-upload-pack", nil))
	if rec.Code != http.StatusNoContent || seen != "/harvest.git/info/refs" {
		t.Errorf("known agency: status %d, manager saw %q", rec.Code, seen)
	}

	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/git/elsewhere/harvest.git/info/refs", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("unknown agency status = %d, want 404", rec.Code)
	}
}
