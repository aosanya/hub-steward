package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

const ownerAccountID = "test-owner"

type keyGroupWalk struct {
	stepRunWalk
	seated   string
	unseated string
}

func newKeyGroupWalk(t *testing.T) keyGroupWalk {
	t.Helper()
	w := apiKeyWalk(t)
	ctx := context.Background()
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	owner, err := um.EnsureActor(ctx, ownerAccountID)
	if err != nil {
		t.Fatalf("EnsureActor: %v", err)
	}
	seated, err := um.CreateGroup(ctx, mwanachamaactor.Group{Name: "Intake desk"})
	if err != nil {
		t.Fatalf("CreateGroup seated: %v", err)
	}
	unseated, err := um.CreateGroup(ctx, mwanachamaactor.Group{Name: "Finance desk"})
	if err != nil {
		t.Fatalf("CreateGroup unseated: %v", err)
	}
	published, err := mgr.GetRole(ctx, w.roles["Volunteer"])
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	kind, err := um.RoleKindForDefinitionRole(ctx, definitionRoleID(agencymodels.DocumentRole{ID: published.ID, Code: published.Code}))
	if err != nil {
		t.Fatalf("RoleKindForDefinitionRole: %v", err)
	}
	if _, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: owner.ID, GroupID: seated.ID, KindID: kind.ID}); err != nil {
		t.Fatalf("GrantRole: %v", err)
	}
	return keyGroupWalk{stepRunWalk: w, seated: seated.ID, unseated: unseated.ID}
}

func (w keyGroupWalk) mint(t *testing.T, body map[string]any) (int, map[string]any) {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.instance+"/api-keys", body, w.owner)
	return rec.Code, decodeObject(t, rec)
}

func (w keyGroupWalk) listed(t *testing.T) []map[string]any {
	t.Helper()
	rec := w.call(t, "GET", "/auth/api-keys", nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("listing keys: %d %s", rec.Code, rec.Body.String())
	}
	return decodeObjects(t, rec)
}

func groupOf(entry map[string]any) string {
	group, _ := entry["group_id"].(string)
	return group
}

func TestAgencyAPIKeyGroup_KeyMadeWithAGroupReportsIt(t *testing.T) {
	w := newKeyGroupWalk(t)
	code, made := w.mint(t, map[string]any{"name": "intake bot", "group_id": w.seated})
	if code != http.StatusCreated {
		t.Fatalf("minting a key for a group the owner is seated in: %d %v, want 201", code, made)
	}
	if got := groupOf(made); got != w.seated {
		t.Errorf("group on the new key: %q, want %q", got, w.seated)
	}
	entries := w.listed(t)
	if len(entries) != 1 || groupOf(entries[0]) != w.seated {
		t.Errorf("group of the key in the key list: %v, want %q", entries, w.seated)
	}
}

func TestAgencyAPIKeyGroup_KeyMadeWithoutAGroupReportsNone(t *testing.T) {
	w := newKeyGroupWalk(t)
	code, made := w.mint(t, map[string]any{"name": "plain bot"})
	if code != http.StatusCreated {
		t.Fatalf("minting a key with no group: %d %v, want 201", code, made)
	}
	if got := groupOf(made); got != "" {
		t.Errorf("group on a key made without one: %q, want none", got)
	}
	entries := w.listed(t)
	if len(entries) != 1 || groupOf(entries[0]) != "" {
		t.Errorf("group of the key in the key list: %v, want none", entries)
	}
}

func TestAgencyAPIKeyGroup_GroupWithoutTheOwnersSeatIsRefusedAndMakesNoKey(t *testing.T) {
	w := newKeyGroupWalk(t)
	for name, group := range map[string]string{"a group where the owner holds no seat": w.unseated, "a group that does not exist": "no-such-group"} {
		code, refused := w.mint(t, map[string]any{"name": "refused bot", "group_id": group})
		if code != http.StatusForbidden {
			t.Errorf("minting a key for %s: %d %v, want 403", name, code, refused)
		}
	}
	if entries := w.listed(t); len(entries) != 0 {
		t.Errorf("keys after the refusals: %v, want none", entries)
	}
}

func TestAgencyAPIKeyGroup_PersonalKeyTakesNoGroup(t *testing.T) {
	w := newKeyGroupWalk(t)
	rec := w.call(t, "POST", "/auth/api-keys", map[string]any{"name": "personal", "group_id": w.seated}, w.owner)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("personal key with a group: %d %s, want 400", rec.Code, rec.Body.String())
	}
}
