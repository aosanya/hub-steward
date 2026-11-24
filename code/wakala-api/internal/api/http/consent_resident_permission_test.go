package http

import (
	"context"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	"wakalaserver/internal/agencies"
)

type consentPermissionWalk struct {
	consentWalk
	publisher string
	reader    string
}

func newConsentPermissionWalk(t *testing.T) consentPermissionWalk {
	t.Helper()
	cw := newConsentWalk(t)
	publisherRole, readerRole := cw.publishedConsentRoles(t)
	ctx := context.Background()
	um, err := cw.reg.ActorManager(ctx, cw.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	publisher := cw.residentInNewGroup(t, um, "Publisher Wren", "Publishers")
	reader := cw.residentInNewGroup(t, um, "Reader Wren", "Readers")
	groups := map[string]string{publisher: publisherRole, reader: readerRole}
	for actorID, roleID := range groups {
		assigned, err := um.ListGroupsForActor(ctx, actorID)
		if err != nil || len(assigned) == 0 {
			t.Fatalf("ListGroupsForActor %s: %v %v", actorID, assigned, err)
		}
		cw.joinedGroup(t, actorID, assigned[0].GroupID, true)
		cw.seatGroupMembers(t, assigned[0].GroupID, roleID)
	}
	return consentPermissionWalk{consentWalk: cw, publisher: publisher, reader: reader}
}

func (cw consentWalk) publishedConsentRoles(t *testing.T) (publisher, reader string) {
	t.Helper()
	ctx := context.Background()
	mgr, err := cw.reg.AgencyManager(ctx, cw.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	draft, err := mgr.CreateDraft(ctx, "consent roles", "", "")
	if err != nil {
		t.Fatalf("CreateDraft: %v", err)
	}
	goal, _ := mgr.CreateGoal(ctx, agencymodels.Goal{DraftID: draft.ID, Title: "Every answer is kept with consent"})
	objective, _ := mgr.CreateObjective(ctx, agencymodels.Objective{DraftID: draft.ID, GoalID: goal.ID, Title: "Publish the consent text"})
	workflow, err := mgr.CreateWorkflow(ctx, agencymodels.Workflow{DraftID: draft.ID, Name: "Consent text"})
	if err != nil {
		t.Fatalf("CreateWorkflow: %v", err)
	}
	if _, err := mgr.CreateWorkflowObjective(ctx, agencymodels.WorkflowObjective{DraftID: draft.ID, WorkflowID: workflow.ID, ObjectiveID: objective.ID}); err != nil {
		t.Fatalf("CreateWorkflowObjective: %v", err)
	}
	created := map[string]string{}
	for name, permissions := range map[string][]string{"Consent publisher": {"consent.publish"}, "Consent reader": {"consent.read"}} {
		role, err := mgr.CreateRole(ctx, agencymodels.Role{DraftID: draft.ID, Name: name, Permissions: permissions})
		if err != nil {
			t.Fatalf("CreateRole %s: %v", name, err)
		}
		created[name] = role.ID
	}
	if _, err := mgr.CreateWorkItem(ctx, agencymodels.WorkItem{DraftID: draft.ID, WorkflowID: workflow.ID, Title: "Publish the text", Ordinality: 1, Kind: agencymodels.StepKindFillForm, RoleID: created["Consent publisher"], FormName: "Text", Questions: boardQuestions}); err != nil {
		t.Fatalf("CreateWorkItem: %v", err)
	}
	if _, err := mgr.PublishAgency(ctx, draft.ID, "", ""); err != nil {
		t.Fatalf("PublishAgency: %v", err)
	}
	cacheMountedSet(t, cw.instance, mountedSet{modules: map[string]bool{"custody": true, "forms": true}})
	return created["Consent publisher"], created["Consent reader"]
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
			cw.mcpRefused(t, subject, "custody_list_consent_versions", map[string]any{"instance_id": cw.instance}, "consent.publish")
			cw.mcpRefused(t, subject, "custody_publish_consent_version", map[string]any{"instance_id": cw.instance, "text": "mine"}, "consent.publish")
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
	if refused := cw.call(t, "GET", base+"/versions", nil, reader); refused.Code != 403 {
		t.Fatalf("list by the role without the permission: %d %s, want 403", refused.Code, refused.Body.String())
	}
	if refused := cw.call(t, "POST", base+"/text", map[string]any{"text": "mine"}, reader); refused.Code != 403 {
		t.Fatalf("publish by the role without the permission: %d %s, want 403", refused.Code, refused.Body.String())
	}
}
