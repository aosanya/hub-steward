package routes_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/routes"
)

func newMux(t *testing.T) *http.ServeMux {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	s, err := mwanachamaagency.SpecFor("cover")
	if err != nil {
		t.Fatal(err)
	}
	if err := mwanachamaagency.Provision(db, s); err != nil {
		t.Fatal(err)
	}
	manager, err := mwanachamaagency.NewAgencyManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	built, err := routes.Build(manager, func(context.Context) string { return "caller-1" })
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	mux := http.NewServeMux()
	for _, rt := range built {
		mux.HandleFunc(rt.Pattern(""), rt.Handler)
	}
	return mux
}

func newMuxWithAgency(t *testing.T) *http.ServeMux {
	t.Helper()
	mux := newMux(t)
	if code, body := send(mux, http.MethodPost, "/agency", map[string]any{"name": "Org"}); code != http.StatusCreated {
		t.Fatalf("agency create = %d %v, want 201", code, body)
	}
	return mux
}

func send(mux *http.ServeMux, method, path string, body any) (int, map[string]any) {
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(method, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}

func TestShapeListsEveryDeclaredOperationSortedByNameWithUniqueActions(t *testing.T) {
	shape := routes.Shape()
	if len(shape) < 100 {
		t.Fatalf("Shape has %d routes, want the full declared table", len(shape))
	}
	seen := map[string]bool{}
	for _, rt := range shape {
		if rt.Action == "" || rt.Method == "" || !strings.HasPrefix(rt.Path, "/") {
			t.Fatalf("route %+v lacks an action, method or rooted path", rt)
		}
		if !strings.HasPrefix(rt.Action, "agency.") {
			t.Fatalf("action %q is outside the agency namespace", rt.Action)
		}
		if seen[rt.Action] {
			t.Fatalf("action %q declared twice", rt.Action)
		}
		seen[rt.Action] = true
	}
	again := routes.Shape()
	for i := range shape {
		if shape[i].Action != again[i].Action || shape[i].Path != again[i].Path {
			t.Fatalf("Shape order changed between calls at %d", i)
		}
	}
}

func TestBuildBindsAHandlerToEveryShapedAddress(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	s, _ := mwanachamaagency.SpecFor("cover")
	manager, err := mwanachamaagency.NewAgencyManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	built, err := routes.Build(manager, func(context.Context) string { return "c" })
	if err != nil {
		t.Fatal(err)
	}
	var shaped, bound []string
	for _, rt := range routes.Shape() {
		shaped = append(shaped, rt.Method+" "+rt.Path+" "+rt.Action)
	}
	for _, rt := range built {
		if rt.Handler == nil {
			t.Fatalf("%s %s has no handler", rt.Method, rt.Path)
		}
		bound = append(bound, rt.Method+" "+rt.Path+" "+rt.Action)
	}
	sort.Strings(shaped)
	sort.Strings(bound)
	if strings.Join(shaped, "\n") != strings.Join(bound, "\n") {
		t.Fatalf("Shape and Build disagree: %d shaped, %d bound", len(shaped), len(bound))
	}
}

func TestRoutesBuildsTheSameTableAsBuild(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	s, _ := mwanachamaagency.SpecFor("cover")
	manager, err := mwanachamaagency.NewAgencyManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	caller := func(context.Context) string { return "c" }
	built, _ := routes.Build(manager, caller)
	if got := routes.Routes(manager, caller); len(got) != len(built) {
		t.Fatalf("Routes gave %d routes, Build gave %d", len(got), len(built))
	}
}

func TestAGoalWithNoDraftNamedIsRefusedWith400(t *testing.T) {
	mux := newMux(t)
	code, body := send(mux, http.MethodPost, "/goals", map[string]any{"title": "Grow"})
	if code != http.StatusBadRequest {
		t.Fatalf("goal with no draft = %d %v, want 400", code, body)
	}
}

func TestAGoalInADraftThatDoesNotExistIsRefusedWith404(t *testing.T) {
	mux := newMux(t)
	code, body := send(mux, http.MethodPost, "/goals", map[string]any{"title": "Grow", "draft_id": "no-such-draft"})
	if code != http.StatusNotFound {
		t.Fatalf("goal in unknown draft = %d %v, want 404", code, body)
	}
}

func TestAGoalCreatedInAnOpenDraftIsListedBackForThatDraftOnly(t *testing.T) {
	mux := newMuxWithAgency(t)
	code, draft := send(mux, http.MethodPost, "/drafts", map[string]any{"description": "first round"})
	if code != http.StatusCreated {
		t.Fatalf("draft create = %d %v, want 201", code, draft)
	}
	draftID, _ := draft["id"].(string)
	if draftID == "" {
		t.Fatalf("draft has no id: %v", draft)
	}
	code, goal := send(mux, http.MethodPost, "/goals", map[string]any{"title": "Grow", "draft_id": draftID})
	if code != http.StatusCreated || goal["title"] != "Grow" {
		t.Fatalf("goal create = %d %v, want 201 titled Grow", code, goal)
	}
	req := httptest.NewRequest(http.MethodGet, "/goals?draft_id="+draftID, nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Grow") {
		t.Fatalf("list in own draft = %d %s, want 200 with Grow", rec.Code, rec.Body)
	}
	_, other := send(mux, http.MethodPost, "/drafts", map[string]any{"description": "second round"})
	otherID, _ := other["id"].(string)
	req = httptest.NewRequest(http.MethodGet, "/goals?draft_id="+otherID, nil)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if strings.Contains(rec.Body.String(), "Grow") {
		t.Fatalf("a goal leaked into another draft: %s", rec.Body)
	}
}

func TestADraftForkedFromAnUnknownDraftIsRefused(t *testing.T) {
	mux := newMuxWithAgency(t)
	code, body := send(mux, http.MethodPost, "/drafts", map[string]any{"forked_from_type": "draft", "forked_from_id": "missing"})
	if code != http.StatusNotFound {
		t.Fatalf("fork of unknown draft = %d %v, want 404", code, body)
	}
}

func TestADraftForkedFromAnUnrecognisedSourceTypeIsRefusedWith400(t *testing.T) {
	mux := newMuxWithAgency(t)
	code, body := send(mux, http.MethodPost, "/drafts", map[string]any{"forked_from_type": "banana", "forked_from_id": "x"})
	if code != http.StatusBadRequest {
		t.Fatalf("fork from banana = %d %v, want 400", code, body)
	}
}

func TestADraftBeforeTheAgencyExistsIsRefusedWith404(t *testing.T) {
	mux := newMux(t)
	code, body := send(mux, http.MethodPost, "/drafts", map[string]any{"description": "early"})
	if code != http.StatusNotFound {
		t.Fatalf("draft with no agency = %d %v, want 404", code, body)
	}
}

func TestASecondAgencyIsRefusedWith409(t *testing.T) {
	mux := newMuxWithAgency(t)
	code, body := send(mux, http.MethodPost, "/agency", map[string]any{"name": "Other"})
	if code != http.StatusConflict {
		t.Fatalf("second agency = %d %v, want 409", code, body)
	}
}
