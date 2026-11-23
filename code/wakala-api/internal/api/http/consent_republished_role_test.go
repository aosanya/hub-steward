package http

import (
	"context"
	"slices"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

func consentRepublishedWalk(t *testing.T) groupRoleWalk {
	t.Helper()
	w := newGroupRoleWalk(t)
	w.deps.rolePermissionsOverride = nil
	return w
}

func (w groupRoleWalk) republishWithPermissions(t *testing.T, fromVersion, role string, permissions []string) string {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	draft, err := mgr.CreateDraft(ctx, "republish "+role, fromVersion, "publication")
	if err != nil {
		t.Fatalf("fork %s: %v", fromVersion, err)
	}
	roles, err := mgr.ListRoles(ctx, draft.ID, mwanachamaagency.RoleFilter{})
	if err != nil {
		t.Fatalf("ListRoles: %v", err)
	}
	forkedID := ""
	for _, r := range roles {
		if r.Name == role {
			r.Permissions = permissions
			if _, err := mgr.UpdateRole(ctx, r); err != nil {
				t.Fatalf("UpdateRole %s: %v", role, err)
			}
			forkedID = r.ID
		}
	}
	w.draftID = draft.ID
	w.publish(t)
	runsModules(t, w.instance, "custody")
	return forkedID
}

func (w groupRoleWalk) giveRoleByID(t *testing.T, group, roleID string) {
	t.Helper()
	holder, ok := w.deps.Registry.(agencies.GroupRoles)
	if !ok {
		t.Fatal("the registry does not hold group roles")
	}
	if err := holder.GiveGroupRole(context.Background(), w.instance, w.group(t, group), roleID); err != nil {
		t.Fatalf("GiveGroupRole %s: %v", group, err)
	}
}

func (w groupRoleWalk) heldCodes(t *testing.T, subject string) []string {
	t.Helper()
	codes, err := w.deps.callerPermissionCodes(withPartitionContext(accounts.WithID(context.Background(), subject), w.instance), w.instance)
	if err != nil {
		t.Fatalf("callerPermissionCodes: %v", err)
	}
	return codes
}

func TestConsentRepublishedRole_AGroupSeatedBeforeThePermissionWasAddedListsTheVersions(t *testing.T) {
	w := consentRepublishedWalk(t)
	id, _ := w.resident(t, "Director", "Directors")
	w.giveRole(t, "Directors", "Reader")
	w.republishWithPermissions(t, "v1", "Reader", []string{"consent.publish"})

	if held := w.heldCodes(t, id); !slices.Contains(held, "consent.publish") {
		t.Fatalf("the caller holds %v, want consent.publish from the live role", held)
	}
	out := w.lookup(t, id, "custody_list_consent_versions")
	if out.IsError {
		t.Fatalf("custody_list_consent_versions: a resident whose group role now carries consent.publish got %q", toolErrorText(out))
	}
}

func TestConsentRepublishedRole_AGroupSeatedBeforeThePermissionWasDroppedIsRefused(t *testing.T) {
	w := consentRepublishedWalk(t)
	id, _ := w.resident(t, "Director", "Directors")
	granted := w.republishWithPermissions(t, "v1", "Reader", []string{"consent.publish"})
	w.giveRoleByID(t, "Directors", granted)
	w.republishWithPermissions(t, "v2", "Reader", []string{"task.read"})

	out := w.lookup(t, id, "custody_list_consent_versions")
	if !out.IsError {
		t.Fatalf("custody_list_consent_versions: a resident whose group role no longer carries consent.publish was admitted")
	}
}

func TestConsentRepublishedRole_AGroupWithoutThePermissionIsRefusedAfterTheRepublish(t *testing.T) {
	w := consentRepublishedWalk(t)
	id, _ := w.resident(t, "Clerk", "Clerks")
	w.giveRole(t, "Clerks", "Worker")
	w.republishWithPermissions(t, "v1", "Reader", []string{"consent.publish"})

	out := w.lookup(t, id, "custody_list_consent_versions")
	if !out.IsError {
		t.Fatalf("custody_list_consent_versions: a resident holding only another role was admitted")
	}
}
