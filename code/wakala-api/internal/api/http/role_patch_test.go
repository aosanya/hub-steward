package http

import (
	"context"
	"net/http"
	"slices"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

type rolePatchWalk struct {
	stepRunWalk
	roleID string
}

func newRolePatchWalk(t *testing.T) rolePatchWalk {
	t.Helper()
	w := newStepRunWalk(t, nil)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	draft, err := mgr.CreateDraft(ctx, "role patch", "", "")
	if err != nil {
		t.Fatalf("CreateDraft: %v", err)
	}
	role, err := mgr.CreateRole(ctx, agencymodels.Role{
		DraftID:     draft.ID,
		Name:        "Triager",
		Description: "Answers backlog asks",
		Permissions: []string{"task.read", "task.edit"},
		Staff:       true,
	})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	w.draftID = draft.ID
	return rolePatchWalk{stepRunWalk: w, roleID: role.ID}
}

func (w rolePatchWalk) patch(t *testing.T, body map[string]any) {
	t.Helper()
	rec := w.call(t, "PATCH", "/instances/"+w.instance+"/roles/"+w.roleID, body, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("patch %v: %d %s", body, rec.Code, rec.Body.String())
	}
}

func (w rolePatchWalk) stored(t *testing.T) agencymodels.Role {
	t.Helper()
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	role, err := mgr.GetRole(context.Background(), w.roleID)
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	return role
}

func TestRolePatchADescriptionOnlyKeepsTheRestOfTheRole(t *testing.T) {
	w := newRolePatchWalk(t)
	w.patch(t, map[string]any{"description": "Answers asks about the backlogs"})
	got := w.stored(t)
	if got.Description != "Answers asks about the backlogs" {
		t.Fatalf("description = %q", got.Description)
	}
	if got.Name != "Triager" {
		t.Fatalf("name = %q, want it kept", got.Name)
	}
	if !slices.Equal(got.Permissions, []string{"task.read", "task.edit"}) {
		t.Fatalf("permissions = %v, want them kept", got.Permissions)
	}
	if !got.Staff {
		t.Fatal("staff was cleared by a description-only patch")
	}
}

func TestRolePatchANameOnlyKeepsTheDescriptionAndPermissions(t *testing.T) {
	w := newRolePatchWalk(t)
	w.patch(t, map[string]any{"name": "Backlog triager"})
	got := w.stored(t)
	if got.Name != "Backlog triager" {
		t.Fatalf("name = %q", got.Name)
	}
	if got.Description != "Answers backlog asks" {
		t.Fatalf("description = %q, want it kept", got.Description)
	}
	if !slices.Equal(got.Permissions, []string{"task.read", "task.edit"}) {
		t.Fatalf("permissions = %v, want them kept", got.Permissions)
	}
}

func TestRolePatchAnExplicitEmptyPermissionsListClearsThem(t *testing.T) {
	w := newRolePatchWalk(t)
	w.patch(t, map[string]any{"permissions": []string{}})
	if got := w.stored(t); len(got.Permissions) != 0 {
		t.Fatalf("permissions = %v, want none", got.Permissions)
	}
}

func TestRolePatchAnExplicitPermissionsListReplacesThem(t *testing.T) {
	w := newRolePatchWalk(t)
	w.patch(t, map[string]any{"permissions": []string{"task.read"}})
	got := w.stored(t)
	if !slices.Equal(got.Permissions, []string{"task.read"}) {
		t.Fatalf("permissions = %v, want [task.read]", got.Permissions)
	}
	if got.Name != "Triager" || got.Description != "Answers backlog asks" {
		t.Fatalf("name and description changed: %q %q", got.Name, got.Description)
	}
}

func TestRolePatchAnExplicitEmptyDescriptionClearsIt(t *testing.T) {
	w := newRolePatchWalk(t)
	w.patch(t, map[string]any{"description": ""})
	if got := w.stored(t); got.Description != "" {
		t.Fatalf("description = %q, want it cleared", got.Description)
	}
}

func TestRolePatchStaffFalseIsHonouredWhenCarried(t *testing.T) {
	w := newRolePatchWalk(t)
	w.patch(t, map[string]any{"staff": false})
	got := w.stored(t)
	if got.Staff {
		t.Fatal("an explicit staff:false was ignored")
	}
	if !slices.Equal(got.Permissions, []string{"task.read", "task.edit"}) {
		t.Fatalf("permissions = %v, want them kept", got.Permissions)
	}
}

func TestRolePatchAnExplicitEmptyNameIsRefused(t *testing.T) {
	w := newRolePatchWalk(t)
	rec := w.call(t, "PATCH", "/instances/"+w.instance+"/roles/"+w.roleID, map[string]any{"name": ""}, w.owner)
	if rec.Code < 400 {
		t.Fatalf("an empty name was accepted: %d %s", rec.Code, rec.Body.String())
	}
	if got := w.stored(t); got.Name != "Triager" {
		t.Fatalf("name = %q after a refused patch", got.Name)
	}
}

func TestRolePatchANameAndDescriptionKeepThePermissions(t *testing.T) {
	w := newRolePatchWalk(t)
	w.patch(t, map[string]any{"name": "Triager", "description": "Calls the pending tool first"})
	got := w.stored(t)
	if got.Description != "Calls the pending tool first" {
		t.Fatalf("description = %q", got.Description)
	}
	if !slices.Equal(got.Permissions, []string{"task.read", "task.edit"}) {
		t.Fatalf("permissions = %v, want them kept", got.Permissions)
	}
}

func TestRolePatchADescriptionOnlyPatchSurvivesPublishing(t *testing.T) {
	w := newStepRunWalk(t, []stepSpec{{title: "Read the board", form: "Read", role: "Reader", questions: boardQuestions}})
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	draft, err := mgr.CreateDraft(ctx, "role patch", "v1", "publication")
	if err != nil {
		t.Fatalf("fork draft: %v", err)
	}
	roles, err := mgr.ListRoles(ctx, draft.ID, mwanachamaagency.RoleFilter{})
	if err != nil || len(roles) == 0 {
		t.Fatalf("the forked draft has roles %v, %v", roles, err)
	}
	role := roles[0]
	role.Permissions = []string{"task.read", "task.edit"}
	if _, err := mgr.UpdateRole(ctx, role); err != nil {
		t.Fatalf("give the role permissions: %v", err)
	}
	w.draftID = draft.ID
	rec := w.call(t, "PATCH", "/instances/"+w.instance+"/roles/"+role.ID, map[string]any{"description": "Reads the board"}, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("patch: %d %s", rec.Code, rec.Body.String())
	}
	w.publish(t)
	live, err := mgr.GetPublicationForChannel(ctx, agencymodels.DefaultChannel)
	if err != nil {
		t.Fatalf("GetPublicationForChannel: %v", err)
	}
	for _, r := range live.Document.Roles {
		if r.Name == role.Name {
			if !slices.Equal(r.Permissions, []string{"task.read", "task.edit"}) {
				t.Fatalf("published permissions = %v, want them kept", r.Permissions)
			}
			if r.Description != "Reads the board" {
				t.Fatalf("published description = %q", r.Description)
			}
			return
		}
	}
	t.Fatalf("the published agency has no %s among %d roles", role.Name, len(live.Document.Roles))
}
