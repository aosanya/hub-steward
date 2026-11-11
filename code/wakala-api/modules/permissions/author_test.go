package mwanachamapermissions

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/modules/permissions/models"
	"wakalaserver/modules/shared/dispatch"
)

type recordedAuthors struct {
	PermissionsManager
	grantedBy, setBy string
}

func (r *recordedAuthors) CreateGrant(_ context.Context, g models.Grant) (models.Grant, error) {
	r.grantedBy = g.GrantedBy
	return g, nil
}

func (r *recordedAuthors) OverridePermission(_ context.Context, p models.Permission) (models.Permission, error) {
	r.setBy = p.SetBy
	return p, nil
}

var sentinels = map[string]error{
	"ErrInvalidRole":            ErrInvalidRole,
	"ErrRoleNotFound":           ErrRoleNotFound,
	"ErrDuplicateRole":          ErrDuplicateRole,
	"ErrInvalidAction":          ErrInvalidAction,
	"ErrInvalidScope":           ErrInvalidScope,
	"ErrInvalidPartition":       ErrInvalidPartition,
	"ErrInvalidGrant":           ErrInvalidGrant,
	"ErrInvalidEnd":             ErrInvalidEnd,
	"ErrGrantNotFound":          ErrGrantNotFound,
	"ErrDuplicateGrant":         ErrDuplicateGrant,
	"ErrSeededRole":             ErrSeededRole,
	"ErrRoleRetired":            ErrRoleRetired,
	"ErrActionsRequired":        ErrActionsRequired,
	"ErrConflict":               ErrConflict,
	"ErrNotPermitted":           ErrNotPermitted,
	"ErrInvalidPermission":      ErrInvalidPermission,
	"ErrPermissionNotFound":     ErrPermissionNotFound,
	"ErrPermissionsNotDeclared": ErrPermissionsNotDeclared,
}

func deps(manager PermissionsManager) dispatch.Deps {
	return dispatch.Deps{
		Manager: manager,
		Errors:  sentinels,
		Caller:  func(context.Context) string { return "the-session" },
	}
}

func routeFor(t *testing.T, manager PermissionsManager, action string) dispatch.Route {
	t.Helper()
	s, err := dispatch.Parse(Operations())
	if err != nil {
		t.Fatalf("parse operations: %v", err)
	}
	routes, err := dispatch.Dispatch(s, deps(manager))
	if err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	for _, route := range routes {
		if route.Action == action {
			return route
		}
	}
	t.Fatalf("no route for %s", action)
	return dispatch.Route{}
}

func send(handler http.HandlerFunc, method, body string, pathValues map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, "/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range pathValues {
		req.SetPathValue(k, v)
	}
	rec := httptest.NewRecorder()
	handler(rec, req)
	return rec
}

func TestAGrantIsMadeByTheCallerNotTheBody(t *testing.T) {
	manager := &recordedAuthors{}
	route := routeFor(t, manager, "permissions.grant.create")
	rec := send(route.Handler, "POST", `{"subject":"s1","scope":"*","role_code":"clerk","granted_by":"forged-owner"}`, nil)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	if manager.grantedBy != "the-session" {
		t.Errorf("the grant names %q as its granter; want the caller's own id the-session, never the body's forged-owner", manager.grantedBy)
	}
}

func TestAnOverrideIsSetByTheCallerNotTheBody(t *testing.T) {
	manager := &recordedAuthors{}
	route := routeFor(t, manager, "permissions.permission.override")
	rec := send(route.Handler, "PUT", `{"held":true,"set_by":"forged-owner"}`,
		map[string]string{"partition": "p1", "permission": "task.read", "role_kind": "clerk"})
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	if manager.setBy != "the-session" {
		t.Errorf("the override names %q as its setter; want the caller's own id the-session, never the body's forged-owner", manager.setBy)
	}
}

func TestPermissionToolsDoNotAskForTheirAuthor(t *testing.T) {
	s, err := dispatch.Parse(Operations())
	if err != nil {
		t.Fatalf("parse operations: %v", err)
	}
	tools, err := dispatch.Tools(s, deps(&recordedAuthors{}))
	if err != nil {
		t.Fatalf("tools: %v", err)
	}
	asked := map[string]string{}
	for _, tool := range tools {
		var schema struct {
			Properties map[string]json.RawMessage `json:"properties"`
		}
		if err := json.Unmarshal(tool.InputSchema, &schema); err != nil {
			t.Fatalf("%s schema: %v", tool.Name, err)
		}
		for _, field := range []string{"granted_by", "set_by"} {
			if _, ok := schema.Properties[field]; ok {
				asked[tool.Name] = field
			}
		}
	}
	if len(asked) > 0 {
		t.Errorf("tools still take an author from the request: %v", asked)
	}
}
