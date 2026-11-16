package mcp

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"testing"

	"wakalaserver/modules/agency/models"
)

func (w roleToolWalk) setPermissions(t *testing.T, args string) error {
	t.Helper()
	tools, err := toolsFor(w.manager, nil)
	if err != nil {
		t.Fatalf("toolsFor: %v", err)
	}
	tool, ok := byName(tools, "agency_set_role_permissions")
	if !ok {
		t.Fatal("agency_set_role_permissions is not a tool")
	}
	_, err = tool.Invoke(context.Background(), json.RawMessage(args))
	return err
}

func TestSetRolePermissionsToolReplacesTheWholeList(t *testing.T) {
	w := newRoleToolWalk(t)
	if err := w.setPermissions(t, `{"role_id":"`+w.roleID+`","permissions":["task.read","notice.post"]}`); err != nil {
		t.Fatalf("set permissions: %v", err)
	}
	got := w.stored(t)
	if !slices.Equal(got.Permissions, []string{"task.read", "notice.post"}) {
		t.Fatalf("permissions = %v, want exactly the list sent", got.Permissions)
	}
	if got.Name != "Triager" || got.Description != "Answers backlog asks" || !got.Staff {
		t.Fatalf("the rest of the role changed: %+v", got)
	}
}

func TestSetRolePermissionsToolClearsTheListWhenSentAnEmptyOne(t *testing.T) {
	w := newRoleToolWalk(t)
	if err := w.setPermissions(t, `{"role_id":"`+w.roleID+`","permissions":[]}`); err != nil {
		t.Fatalf("set permissions: %v", err)
	}
	if got := w.stored(t); len(got.Permissions) != 0 {
		t.Fatalf("permissions = %v, want none", got.Permissions)
	}
}

func TestSetRolePermissionsToolKeepsEachCodeOnce(t *testing.T) {
	w := newRoleToolWalk(t)
	if err := w.setPermissions(t, `{"role_id":"`+w.roleID+`","permissions":["task.read","task.read"]}`); err != nil {
		t.Fatalf("set permissions: %v", err)
	}
	if got := w.stored(t); !slices.Equal(got.Permissions, []string{"task.read"}) {
		t.Fatalf("permissions = %v, want task.read once", got.Permissions)
	}
}

func TestSetRolePermissionsToolRefusesEveryLockedCodeInWords(t *testing.T) {
	w := newRoleToolWalk(t)
	for _, code := range []string{"agent.manage", "api_key.manage", "agency.go_live", "agency.delete", "permission.override"} {
		err := w.setPermissions(t, `{"role_id":"`+w.roleID+`","permissions":["task.read","`+code+`"]}`)
		if err == nil {
			t.Fatalf("%s was ticked on a role", code)
		}
		if !strings.Contains(err.Error(), code) || !strings.Contains(err.Error(), "owner") {
			t.Fatalf("%s refusal does not say what is wrong: %v", code, err)
		}
		if got := w.stored(t); !slices.Equal(got.Permissions, []string{"task.read", "task.edit"}) {
			t.Fatalf("a refused call changed the list to %v", got.Permissions)
		}
	}
}

func TestSetRolePermissionsToolRefusesUnknownCodesInWords(t *testing.T) {
	w := newRoleToolWalk(t)
	err := w.setPermissions(t, `{"role_id":"`+w.roleID+`","permissions":["task.read","no.such.code","also.missing"]}`)
	if err == nil {
		t.Fatal("unknown codes were accepted")
	}
	for _, want := range []string{"no.such.code", "also.missing", "not a permission"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("refusal %q does not mention %q", err.Error(), want)
		}
	}
	if got := w.stored(t); !slices.Equal(got.Permissions, []string{"task.read", "task.edit"}) {
		t.Fatalf("a refused call changed the list to %v", got.Permissions)
	}
}

func TestSetRolePermissionsToolRefusesAnArchivedDraft(t *testing.T) {
	w := newRoleToolWalk(t)
	if _, err := w.manager.ArchiveDraft(context.Background(), w.draftID); err != nil {
		t.Fatalf("ArchiveDraft: %v", err)
	}
	if err := w.setPermissions(t, `{"role_id":"`+w.roleID+`","permissions":["task.read"]}`); err == nil {
		t.Fatal("a role of an archived draft was changed")
	}
}

func TestOnlyTheOverrideCodeCarriesTheSetPermissionsAction(t *testing.T) {
	const action = "agency.role.set_permissions"
	holders := []string{}
	for _, p := range models.PermissionCatalog() {
		if slices.Contains(p.Actions, action) {
			holders = append(holders, p.Code)
		}
	}
	if !slices.Equal(holders, []string{"permission.override"}) {
		t.Fatalf("codes carrying %s = %v, want only permission.override", action, holders)
	}
}
