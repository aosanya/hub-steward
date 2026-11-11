package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"sync/atomic"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
	"wakalaserver/modules/shared/dispatch"
)

var roleToolDatabases atomic.Int64

type roleToolWalk struct {
	manager mwanachamaagency.AgencyManager
	tool    dispatch.Tool
	roleID  string
	draftID string
}

func newRoleToolWalk(t *testing.T) roleToolWalk {
	t.Helper()
	dsn := fmt.Sprintf("file:wakala_role_tool_%d?mode=memory&cache=shared", roleToolDatabases.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	spec, err := mwanachamaagency.SpecFor("roletool")
	if err != nil {
		t.Fatalf("SpecFor: %v", err)
	}
	if err := mwanachamaagency.Provision(db, spec); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	manager, err := mwanachamaagency.NewAgencyManager(db, spec)
	if err != nil {
		t.Fatalf("NewAgencyManager: %v", err)
	}
	ctx := context.Background()
	if _, err := manager.CreateAgency(ctx, models.Agency{Name: "Role tool"}); err != nil {
		t.Fatalf("CreateAgency: %v", err)
	}
	draft, err := manager.CreateDraft(ctx, "role tool", "", "")
	if err != nil {
		t.Fatalf("CreateDraft: %v", err)
	}
	role, err := manager.CreateRole(ctx, models.Role{
		DraftID:     draft.ID,
		Name:        "Triager",
		Description: "Answers backlog asks",
		Permissions: []string{"task.read", "task.edit"},
		Staff:       true,
	})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	tools, err := toolsFor(manager, nil)
	if err != nil {
		t.Fatalf("toolsFor: %v", err)
	}
	tool, ok := byName(tools, "agency_update_role")
	if !ok {
		t.Fatal("agency_update_role is not a tool")
	}
	return roleToolWalk{manager: manager, tool: tool, roleID: role.ID, draftID: draft.ID}
}

func (w roleToolWalk) call(t *testing.T, args string) {
	t.Helper()
	if _, err := w.tool.Invoke(context.Background(), json.RawMessage(args)); err != nil {
		t.Fatalf("agency_update_role %s: %v", args, err)
	}
}

func (w roleToolWalk) stored(t *testing.T) models.Role {
	t.Helper()
	role, err := w.manager.GetRole(context.Background(), w.roleID)
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	return role
}

func TestUpdateRoleToolKeepsWhatTheArgumentsLeaveOut(t *testing.T) {
	w := newRoleToolWalk(t)
	w.call(t, `{"draft_id":"`+w.draftID+`","role_id":"`+w.roleID+`","name":"Triager","description":"Calls the pending tool first"}`)
	got := w.stored(t)
	if got.Description != "Calls the pending tool first" {
		t.Fatalf("description = %q", got.Description)
	}
	if !slices.Equal(got.Permissions, []string{"task.read", "task.edit"}) {
		t.Fatalf("permissions = %v, want them kept", got.Permissions)
	}
	if !got.Staff {
		t.Fatal("staff was cleared by a call that did not carry it")
	}
}

func TestUpdateRoleToolClearsPermissionsWhenAskedTo(t *testing.T) {
	w := newRoleToolWalk(t)
	w.call(t, `{"draft_id":"`+w.draftID+`","role_id":"`+w.roleID+`","name":"Triager","permissions":[]}`)
	got := w.stored(t)
	if len(got.Permissions) != 0 || got.Name != "Triager" {
		t.Fatalf("permissions = %v name = %q", got.Permissions, got.Name)
	}
}

func TestUpdateRoleToolReplacesPermissionsWhenGivenAList(t *testing.T) {
	w := newRoleToolWalk(t)
	w.call(t, `{"draft_id":"`+w.draftID+`","role_id":"`+w.roleID+`","name":"Triager","permissions":["task.read"]}`)
	got := w.stored(t)
	if !slices.Equal(got.Permissions, []string{"task.read"}) || got.Description != "Answers backlog asks" {
		t.Fatalf("permissions = %v description = %q", got.Permissions, got.Description)
	}
}
