package http

import (
	"context"
	"testing"

	"wakalaserver/internal/agencies"
	mwanachamaactor "wakalaserver/modules/actor"
)

const (
	consentPublisherRole = "R-1"
	consentReaderRole    = "R-2"
)

type consentPermissionWalk struct {
	consentWalk
	publisher string
	reader    string
}

func newConsentPermissionWalk(t *testing.T) consentPermissionWalk {
	t.Helper()
	cw := newConsentWalk(t)
	perms := map[string][]string{
		consentPublisherRole: {"consent.publish"},
		consentReaderRole:    {"consent.read"},
	}
	cw.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		return perms[roleID], nil
	}
	holder, ok := cw.reg.(agencies.GroupRoles)
	if !ok {
		t.Fatal("the registry does not hold group roles")
	}
	ctx := context.Background()
	um, err := cw.reg.ActorManager(ctx, cw.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	publisher := cw.residentInNewGroup(t, um, "Publisher Wren", "Publishers")
	reader := cw.residentInNewGroup(t, um, "Reader Wren", "Readers")
	groups := map[string]string{publisher: consentPublisherRole, reader: consentReaderRole}
	for actorID, roleID := range groups {
		assigned, err := um.ListGroupsForActor(ctx, actorID)
		if err != nil || len(assigned) == 0 {
			t.Fatalf("ListGroupsForActor %s: %v %v", actorID, assigned, err)
		}
		if err := holder.GiveGroupRole(ctx, cw.instance, assigned[0].GroupID, roleID); err != nil {
			t.Fatalf("GiveGroupRole %s: %v", roleID, err)
		}
	}
	return consentPermissionWalk{consentWalk: cw, publisher: publisher, reader: reader}
}

func (cw consentWalk) residentInNewGroup(t *testing.T, um mwanachamaactor.UserManager, name, groupName string) string {
	t.Helper()
	ctx := context.Background()
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
	if err != nil {
		t.Fatalf("CreateActor %s: %v", name, err)
	}
	if err := cw.reg.AddMember(ctx, cw.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember %s: %v", name, err)
	}
	group, err := um.CreateGroup(ctx, mwanachamaactor.Group{Name: groupName})
	if err != nil {
		t.Fatalf("CreateGroup %s: %v", groupName, err)
	}
	if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: actor.ID, GroupID: group.ID}); err != nil {
		t.Fatalf("AssignGroup %s: %v", name, err)
	}
	return actor.ID
}

func TestConsentResidentPermission_AResidentWhoseGroupRoleHoldsConsentPublishPublishesTheText(t *testing.T) {
	cw := newConsentPermissionWalk(t)
	published := cw.mcpOK(t, cw.publisher, "custody_publish_consent_version", map[string]any{"instance_id": cw.instance, "text": "We keep your answers to run the ward consultation."})
	if published["version"] != "v1" {
		t.Fatalf("publication by the role holder: %v, want v1", published)
	}
}

func TestConsentResidentPermission_AResidentWhoseGroupRoleHoldsConsentPublishListsTheVersions(t *testing.T) {
	cw := newConsentPermissionWalk(t)
	cw.mcpOK(t, "test-owner", "custody_publish_consent_version", map[string]any{"instance_id": cw.instance, "text": "We keep your answers."})
	listed := cw.mcpOK(t, cw.publisher, "custody_list_consent_versions", map[string]any{"instance_id": cw.instance})
	rows, _ := listed["items"].([]any)
	if len(rows) != 1 {
		t.Fatalf("version list for the role holder: %v, want the one published row", listed)
	}
}

func TestConsentResidentPermission_AResidentWhoseRoleLacksConsentPublishIsRefusedBothTools(t *testing.T) {
	cw := newConsentPermissionWalk(t)
	for name, subject := range map[string]string{"role without the permission": cw.reader, "resident with no role": cw.actorID} {
		t.Run(name, func(t *testing.T) {
			cw.mcpRefused(t, subject, "custody_list_consent_versions", map[string]any{"instance_id": cw.instance}, "instance not found")
			cw.mcpRefused(t, subject, "custody_publish_consent_version", map[string]any{"instance_id": cw.instance, "text": "mine"}, "instance not found")
		})
	}
}

func TestConsentResidentPermission_AnyResidentReadsTheTextInForce(t *testing.T) {
	cw := newConsentPermissionWalk(t)
	cw.mcpOK(t, "test-owner", "custody_publish_consent_version", map[string]any{"instance_id": cw.instance, "text": "We keep your answers."})
	for name, subject := range map[string]string{"publisher": cw.publisher, "reader": cw.reader, "resident with no role": cw.actorID} {
		t.Run(name, func(t *testing.T) {
			inForce := cw.mcpOK(t, subject, "custody_get_in_force_consent", map[string]any{"instance_id": cw.instance})
			if inForce["version"] != "v1" {
				t.Fatalf("text in force for %s: %v, want v1", name, inForce)
			}
		})
	}
}

func TestConsentResidentPermission_RestRoutesAgreeWithTheTools(t *testing.T) {
	cw := newConsentPermissionWalk(t)
	base := "/instances/" + cw.instance + "/custody/consent"
	publisher := cw.cookieFor(t, cw.publisher)
	reader := cw.cookieFor(t, cw.reader)
	published := cw.call(t, "POST", base+"/text", map[string]any{"text": "We keep your answers."}, publisher)
	if published.Code != 201 {
		t.Fatalf("publish by the role holder: %d %s, want 201", published.Code, published.Body.String())
	}
	if listed := cw.call(t, "GET", base+"/versions", nil, publisher); listed.Code != 200 {
		t.Fatalf("list by the role holder: %d %s, want 200", listed.Code, listed.Body.String())
	}
	if refused := cw.call(t, "GET", base+"/versions", nil, reader); refused.Code != 404 {
		t.Fatalf("list by the role without the permission: %d %s, want 404", refused.Code, refused.Body.String())
	}
	if refused := cw.call(t, "POST", base+"/text", map[string]any{"text": "mine"}, reader); refused.Code != 404 {
		t.Fatalf("publish by the role without the permission: %d %s, want 404", refused.Code, refused.Body.String())
	}
}
