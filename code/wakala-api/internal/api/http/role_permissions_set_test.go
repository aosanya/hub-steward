package http

import (
	"context"
	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	"slices"
	"testing"

	"wakalaserver/internal/agencies"
)

func (w designAgentWalk) setRolePermissions(t *testing.T, subject string, codes []string) (failed bool, text string) {
	t.Helper()
	out := w.mcpCall(t, subject, "agency_set_role_permissions", map[string]any{
		"instance_id": w.instance, "role_id": w.roleID, "permissions": codes,
	})
	if out.IsError {
		return true, toolErrorText(out)
	}
	return false, ""
}

func (w designAgentWalk) draftPermissions(t *testing.T) []string {
	t.Helper()
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	role, err := mgr.GetRole(context.Background(), w.roleID)
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	return role.Permissions
}

func TestSetRolePermissions_OwnerTicksARoleOverMCP(t *testing.T) {
	w := newDesignAgentWalk(t)
	if failed, text := w.setRolePermissions(t, "test-owner", []string{"task.read", "notice.post"}); failed {
		t.Fatalf("owner setting a role's permissions: %s", text)
	}
	if got := w.draftPermissions(t); !slices.Equal(got, []string{"task.read", "notice.post"}) {
		t.Fatalf("draft permissions = %v", got)
	}
}

func TestSetRolePermissions_AgentWithoutTheOverrideCodeIsRefused(t *testing.T) {
	w := newDesignAgentWalk(t)
	if failed, _ := w.setRolePermissions(t, "agent-chat", []string{"task.read"}); !failed {
		t.Fatal("an agent without permission.override changed a role's permissions")
	}
	if got := w.draftPermissions(t); len(got) != 0 {
		t.Fatalf("a refused agent left permissions %v", got)
	}
}

func TestSetRolePermissions_StrangerAndResidentAreRefused(t *testing.T) {
	w := newDesignAgentWalk(t)
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "resident-x", agencies.RoleResident); err != nil {
		t.Fatalf("AddMember resident: %v", err)
	}
	for _, who := range []string{"resident-x", "stranger-x"} {
		if failed, _ := w.setRolePermissions(t, who, []string{"task.read"}); !failed {
			t.Errorf("%s changed a role's permissions", who)
		}
	}
	if got := w.draftPermissions(t); len(got) != 0 {
		t.Fatalf("a refused caller left permissions %v", got)
	}
}

func TestSetRolePermissions_OwnerCannotTickALockedCode(t *testing.T) {
	w := newDesignAgentWalk(t)
	failed, text := w.setRolePermissions(t, "test-owner", []string{"permission.override"})
	if !failed || text == "" {
		t.Fatalf("owner ticking a locked code: failed=%v text=%q", failed, text)
	}
	if got := w.draftPermissions(t); len(got) != 0 {
		t.Fatalf("a refused call left permissions %v", got)
	}
}

func TestSetRolePermissions_ChangePublishesAsANewVersion(t *testing.T) {
	w := newDesignAgentWalk(t)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	publications, err := mgr.ListPublications(ctx, mwanachamaagency.PublicationFilter{})
	if err != nil {
		t.Fatalf("ListPublications: %v", err)
	}
	if len(publications) == 0 {
		if _, err := mgr.PublishAgency(ctx, w.draftID, "", ""); err != nil {
			t.Fatalf("first PublishAgency: %v", err)
		}
	}
	if failed, text := w.setRolePermissions(t, "test-owner", []string{"task.read"}); failed {
		t.Fatalf("set permissions: %s", text)
	}
	if _, err := mgr.PublishAgency(ctx, w.draftID, "", ""); err != nil {
		t.Fatalf("a permissions change alone was not publishable: %v", err)
	}
}
