package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	insights "wakalaserver/modules/insights"
)

func sqliteManager(t *testing.T) insights.InsightManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := insights.SpecFor("routes")
	if err != nil {
		t.Fatal(err)
	}
	if err := insights.Provision(db, s); err != nil {
		t.Fatal(err)
	}
	im, err := insights.NewInsightManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return im
}

func serve(t *testing.T, im insights.InsightManager) *http.ServeMux {
	t.Helper()
	mux := http.NewServeMux()
	for _, rt := range Routes(im) {
		mux.HandleFunc(rt.Pattern(""), rt.Handler)
	}
	return mux
}

func call(mux *http.ServeMux, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func TestShapeListsTheInsightEndpoints(t *testing.T) {
	seen := map[string]bool{}
	for _, rt := range Shape() {
		seen[rt.Method+" "+rt.Path] = true
		if rt.Action == "" {
			t.Fatalf("%s %s names no action", rt.Method, rt.Path)
		}
	}
	for _, want := range []string{"POST /insights", "GET /insights", "GET /insights/counts"} {
		if !seen[want] {
			t.Fatalf("%s missing from %v", want, seen)
		}
	}
}

func TestAnInsightIsRecordedReadAndListedOverHTTP(t *testing.T) {
	mux := serve(t, sqliteManager(t))
	created := call(mux, http.MethodPost, "/insights", `{"summary":"imports are slow","repo":"hub-steward","subject_id":"ward-a"}`)
	if created.Code >= 300 {
		t.Fatalf("status %d: %s", created.Code, created.Body.String())
	}
	var made insights.Insight
	if err := json.Unmarshal(created.Body.Bytes(), &made); err != nil || made.ID == "" {
		t.Fatalf("%v %s", err, created.Body.String())
	}
	read := call(mux, http.MethodGet, "/insights/"+made.ID, "")
	if read.Code != http.StatusOK || !strings.Contains(read.Body.String(), "imports are slow") {
		t.Fatalf("status %d: %s", read.Code, read.Body.String())
	}
	list := call(mux, http.MethodGet, "/insights?repo=hub-steward", "")
	if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), made.ID) {
		t.Fatalf("status %d: %s", list.Code, list.Body.String())
	}
	none := call(mux, http.MethodGet, "/insights?repo=other", "")
	if none.Code != http.StatusOK || strings.Contains(none.Body.String(), made.ID) {
		t.Fatalf("status %d: %s", none.Code, none.Body.String())
	}
}

func TestAMissingInsightIs404AndAnInvalidOneIs400(t *testing.T) {
	mux := serve(t, sqliteManager(t))
	if rec := call(mux, http.MethodGet, "/insights/ghost", ""); rec.Code != http.StatusNotFound {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if rec := call(mux, http.MethodPost, "/insights", `{"repo":"r"}`); rec.Code != http.StatusBadRequest && rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
}

func TestNotesAreAddedAndListedOverHTTP(t *testing.T) {
	im := sqliteManager(t)
	mux := serve(t, im)
	in, err := im.CreateInsight(context.Background(), insights.Insight{Summary: "s"})
	if err != nil {
		t.Fatal(err)
	}
	added := call(mux, http.MethodPost, "/insights/"+in.ID+"/notes", `{"text":"seen again"}`)
	if added.Code >= 300 {
		t.Fatalf("status %d: %s", added.Code, added.Body.String())
	}
	list := call(mux, http.MethodGet, "/insights/"+in.ID+"/notes", "")
	if list.Code != http.StatusOK || !strings.Contains(list.Body.String(), "seen again") {
		t.Fatalf("status %d: %s", list.Code, list.Body.String())
	}
}

func TestBuildAndRoutesForAgreeOnTheRouteCount(t *testing.T) {
	im := sqliteManager(t)
	built, err := Build(im)
	if err != nil {
		t.Fatal(err)
	}
	if len(built) == 0 || len(built) != len(RoutesFor(im, Mount{})) || len(built) != len(Shape()) {
		t.Fatalf("%d routes built, %d shaped", len(built), len(Shape()))
	}
}

func TestFieldDocsMarkRequiredAndStoreOwnedFields(t *testing.T) {
	fields, err := Fields()
	if err != nil {
		t.Fatal(err)
	}
	if !fields["Insight.summary"].Required {
		t.Fatalf("%+v", fields["Insight.summary"])
	}
	if !fields["Insight.created_at"].ReadOnly || !fields["Insight.id"].ReadOnly || !fields["InsightNote.created_at"].ReadOnly {
		t.Fatal("ids and times must be read only")
	}
	if fields["Insight.summary"].ReadOnly {
		t.Fatal("the summary is typed by the caller")
	}
	if got := fields["Insight.source"].Values; len(got) != 2 {
		t.Fatalf("source values = %v", got)
	}
	if fields["InsightFilter.repo"].Description == "" || fields["InsightFilter.subject_id"].Description == "" {
		t.Fatal("filters need a description")
	}
}

func TestToolsRecordAnInsightForAnAgent(t *testing.T) {
	im := sqliteManager(t)
	tools, err := BuildTools(im)
	if err != nil {
		t.Fatal(err)
	}
	if len(tools) == 0 || len(tools) != len(ToolsFor(im, Mount{})) {
		t.Fatalf("%d tools", len(tools))
	}
	var create, list string
	byName := map[string]bool{}
	for _, tool := range tools {
		byName[tool.Name] = true
		if tool.Description == "" || !json.Valid(tool.InputSchema) {
			t.Fatalf("tool %s is not described or has no schema", tool.Name)
		}
		switch {
		case tool.Name == "insight_create":
			create = tool.Name
		case tool.Name == "insight_list":
			list = tool.Name
		}
	}
	if create == "" || list == "" {
		t.Fatalf("tools = %v", byName)
	}
	for _, tool := range tools {
		if tool.Name != create {
			continue
		}
		if _, err := tool.Invoke(context.Background(), json.RawMessage(`{"summary":"via a tool"}`)); err != nil {
			t.Fatal(err)
		}
	}
	got, err := im.ListInsights(context.Background(), insights.InsightFilter{})
	if err != nil || len(got) != 1 || got[0].Summary != "via a tool" {
		t.Fatalf("%+v %v", got, err)
	}
}
