package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	catalog "wakalaserver/modules/catalog"
	"github.com/aosanya/mwanachama-backend-shared/spec"
)

const (
	listOfPersonAction = "catalog.raised_item.list_of_person"
	listMineAction     = "catalog.raised_item.list_mine"
	listOfPersonTool   = "catalog_raised_item_list_of_person"
)

func memoryCatalog(t *testing.T) catalog.CatalogManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := catalog.SpecFor("personraised", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := spec.Migrate(db, s); err != nil {
		t.Fatal(err)
	}
	cm, err := catalog.NewCatalogManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return cm
}

func catalogWithTwoResidentsRaising(t *testing.T) catalog.CatalogManager {
	t.Helper()
	cm := memoryCatalog(t)
	ctx := context.Background()
	for _, item := range []catalog.RaisedItem{
		{Title: "Broken street lamp", Topic: "Lighting", RaisedBy: "resident-1"},
		{Title: "Pothole on Fo utca", Topic: "Roads", RaisedBy: "resident-1"},
		{Title: "Noise after midnight", Topic: "Noise", RaisedBy: "resident-2"},
	} {
		if _, err := cm.RaiseItem(ctx, item); err != nil {
			t.Fatalf("RaiseItem %s: %v", item.Title, err)
		}
	}
	return cm
}

func routeForAction(t *testing.T, cm catalog.CatalogManager, caller string, action string) Route {
	t.Helper()
	mount := Mount{Caller: func(context.Context) string { return caller }}
	for _, route := range RoutesFor(cm, mount) {
		if route.Action == action {
			return route
		}
	}
	t.Fatalf("the catalog route table has no route for %s", action)
	return Route{}
}

func titlesOf(t *testing.T, raw []byte) []string {
	t.Helper()
	var rows []struct {
		Title    string `json:"title"`
		RaisedBy string `json:"raised_by"`
	}
	if err := json.Unmarshal(raw, &rows); err != nil {
		t.Fatalf("body is not a list of items: %s (%v)", raw, err)
	}
	var titles []string
	for _, row := range rows {
		titles = append(titles, row.Title)
	}
	slices.Sort(titles)
	return titles
}

func TestTheListOfAPersonRouteIsGetRaisedItemsByPerson(t *testing.T) {
	route := routeForAction(t, catalogWithTwoResidentsRaising(t), "clerk-1", listOfPersonAction)
	if route.Method != http.MethodGet || route.Path != "/raised-items/by-person" {
		t.Fatalf("route = %s %s, want GET /raised-items/by-person", route.Method, route.Path)
	}
}

func TestTheListOfAPersonRouteAnswersThePersonNamedNotTheCaller(t *testing.T) {
	cm := catalogWithTwoResidentsRaising(t)
	route := routeForAction(t, cm, "clerk-1", listOfPersonAction)
	for person, want := range map[string][]string{
		"resident-1": {"Broken street lamp", "Pothole on Fo utca"},
		"resident-2": {"Noise after midnight"},
		"nobody":     nil,
	} {
		req := httptest.NewRequest(http.MethodGet, "/raised-items/by-person?raised_by="+person, nil)
		rec := httptest.NewRecorder()
		route.Handler(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("by-person for %s answered %d %s", person, rec.Code, rec.Body.String())
		}
		if got := titlesOf(t, rec.Body.Bytes()); !slices.Equal(got, want) {
			t.Errorf("items of %s = %v, want %v", person, got, want)
		}
	}
}

func TestTheListOfAPersonRouteRefusesAnEmptyOrMissingPerson(t *testing.T) {
	route := routeForAction(t, catalogWithTwoResidentsRaising(t), "clerk-1", listOfPersonAction)
	for _, target := range []string{"/raised-items/by-person", "/raised-items/by-person?raised_by="} {
		rec := httptest.NewRecorder()
		route.Handler(rec, httptest.NewRequest(http.MethodGet, target, nil))
		if rec.Code != http.StatusBadRequest {
			t.Errorf("GET %s answered %d %s, want 400", target, rec.Code, rec.Body.String())
		}
	}
}

func TestMyRaisedItemsAreStillTheCallersOwnWhoeverIsNamed(t *testing.T) {
	cm := catalogWithTwoResidentsRaising(t)
	route := routeForAction(t, cm, "resident-2", listMineAction)
	rec := httptest.NewRecorder()
	route.Handler(rec, httptest.NewRequest(http.MethodGet, "/raised-items/mine?raised_by=resident-1", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("mine answered %d %s", rec.Code, rec.Body.String())
	}
	if got := titlesOf(t, rec.Body.Bytes()); !slices.Equal(got, []string{"Noise after midnight"}) {
		t.Errorf("mine for resident-2 naming resident-1 = %v, want only resident-2's own item", got)
	}
}

func listOfPersonTooling(t *testing.T, cm catalog.CatalogManager) Tool {
	t.Helper()
	for _, tool := range ToolsFor(cm, Mount{Caller: func(context.Context) string { return "clerk-1" }}) {
		if tool.Action == listOfPersonAction {
			return tool
		}
	}
	t.Fatalf("the catalog tools have no tool for %s", listOfPersonAction)
	return Tool{}
}

func TestTheListOfAPersonToolIsNamedAndRequiresRaisedBy(t *testing.T) {
	tool := listOfPersonTooling(t, catalogWithTwoResidentsRaising(t))
	if tool.Name != listOfPersonTool {
		t.Errorf("tool name = %q, want %q", tool.Name, listOfPersonTool)
	}
	var schema struct {
		Required []string `json:"required"`
	}
	if err := json.Unmarshal(tool.InputSchema, &schema); err != nil {
		t.Fatalf("schema: %v", err)
	}
	if !slices.Contains(schema.Required, "raised_by") {
		t.Errorf("raised_by is not required: %s", tool.InputSchema)
	}
}

func TestTheListOfAPersonToolReturnsThePersonsItemsAndRefusesNobody(t *testing.T) {
	tool := listOfPersonTooling(t, catalogWithTwoResidentsRaising(t))
	out, err := tool.Invoke(context.Background(), json.RawMessage(`{"raised_by":"resident-2"}`))
	if err != nil {
		t.Fatalf("Invoke: %v", err)
	}
	raw, err := json.Marshal(out)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if got := titlesOf(t, raw); !slices.Equal(got, []string{"Noise after midnight"}) {
		t.Errorf("tool items of resident-2 = %v, want only resident-2's", got)
	}
	if _, err := tool.Invoke(context.Background(), json.RawMessage(`{"raised_by":""}`)); err == nil {
		t.Error("an empty raised_by was answered")
	}
	if _, err := tool.Invoke(context.Background(), json.RawMessage(`{}`)); err == nil {
		t.Error("a missing raised_by was answered")
	}
}
