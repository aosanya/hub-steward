package routes

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	workspace "wakalaserver/modules/workspace"
	"wakalaserver/modules/workspace/models"
)

type workbookOwners struct {
	workspace.WorkspaceManager
	createdFor, listedFor, usedBy string
}

func (w *workbookOwners) CreateWorkbook(_ context.Context, b models.Workbook) (models.Workbook, error) {
	w.createdFor = b.Owner
	return b, nil
}

func (w *workbookOwners) ListWorkbooks(_ context.Context, owner string, _ models.WorkbookFilter) ([]models.Workbook, error) {
	w.listedFor = owner
	return nil, nil
}

func (w *workbookOwners) Record(_ context.Context, u models.Use) (models.Use, error) {
	w.usedBy = u.Subject
	return u, nil
}

func routeOf(t *testing.T, manager workspace.WorkspaceManager, action string) Route {
	t.Helper()
	for _, route := range OwnerRoutesFor(manager, theSession) {
		if route.Action == action {
			return route
		}
	}
	t.Fatalf("no route for %s", action)
	return Route{}
}

func call(route Route, method, target, body string, pathValues map[string]string) {
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range pathValues {
		req.SetPathValue(k, v)
	}
	route.Handler(httptest.NewRecorder(), req)
}

func TestAWorkbookIsCreatedForTheCallerNotTheBodysOwner(t *testing.T) {
	manager := &workbookOwners{}
	call(routeOf(t, manager, "workspace.workbook.create"), "POST", "/", `{"title":"Ward","owner":"forged-clerk"}`, nil)
	if manager.createdFor != "the-session" {
		t.Errorf("the workbook belongs to %q; want the-session, never the body's forged-clerk", manager.createdFor)
	}
}

func TestWorkbooksAreListedForTheCallerNotTheQuerysOwner(t *testing.T) {
	manager := &workbookOwners{}
	call(routeOf(t, manager, "workspace.workbook.list"), "GET", "/?owner=forged-clerk", "", nil)
	if manager.listedFor != "the-session" {
		t.Errorf("the list was read for %q; want the-session, never the query's forged-clerk", manager.listedFor)
	}
}

func TestAUseIsRecordedForTheCallerNotTheBodysSubject(t *testing.T) {
	manager := &workbookOwners{}
	call(routeOf(t, manager, "workspace.use.record"), "POST", "/", `{"action":"x","subject":"forged-clerk"}`, map[string]string{"workbook_id": "w1"})
	if manager.usedBy != "the-session" {
		t.Errorf("the use names %q; want the-session, never the body's forged-clerk", manager.usedBy)
	}
}

func TestNoWorkbookToolAsksWhoOwnsOrUsesIt(t *testing.T) {
	for _, tool := range ToolsFor(&workbookOwners{}, theSession) {
		wanted := map[string]string{
			"workspace.workbook.create": "owner",
			"workspace.workbook.list":   "owner",
			"workspace.use.record":      "subject",
		}[tool.Action]
		if wanted == "" {
			continue
		}
		var schema struct {
			Properties map[string]json.RawMessage `json:"properties"`
		}
		if err := json.Unmarshal(tool.InputSchema, &schema); err != nil {
			t.Fatalf("schema: %v", err)
		}
		if _, asked := schema.Properties[wanted]; asked {
			t.Errorf("%s still takes %s from the request; the caller signs it", tool.Name, wanted)
		}
	}
}
