package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	"github.com/aosanya/mwanachama-backend-agency/models"
)

type publishedRoleWalk struct {
	ctx     context.Context
	mgr     mwanachamaagency.AgencyManager
	draftID string
	role    models.Role
}

func newPublishedRoleWalk(t *testing.T, permissions []string, staff bool) publishedRoleWalk {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("testdata", "git_mounted_agency.json"))
	if err != nil {
		t.Fatalf("read the fixture: %v", err)
	}
	w := newStepRunWalk(t, nil)
	rec := w.call(t, "POST", "/instances/import", json.RawMessage(raw), w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode import result: %v", err)
	}
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	role, err := mgr.CreateRole(ctx, models.Role{
		DraftID: result.DraftID, Name: "Council risk reader", Description: "Reads the risks",
		Permissions: permissions, Staff: staff,
	})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	if _, err := mgr.PublishAgency(ctx, result.DraftID, "", ""); err != nil {
		t.Fatalf("first PublishAgency: %v", err)
	}
	return publishedRoleWalk{ctx: ctx, mgr: mgr, draftID: result.DraftID, role: role}
}

func (p publishedRoleWalk) change(t *testing.T, edit func(*models.Role)) {
	t.Helper()
	current, err := p.mgr.GetRole(p.ctx, p.role.ID)
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	edit(&current)
	if _, err := p.mgr.UpdateRole(p.ctx, current); err != nil {
		t.Fatalf("UpdateRole: %v", err)
	}
}

func (p publishedRoleWalk) publishSecond(t *testing.T) models.AgencyPublication {
	t.Helper()
	publication, err := p.mgr.PublishAgency(p.ctx, p.draftID, "", "")
	if errors.Is(err, mwanachamaagency.ErrNoChangesDetected) {
		t.Fatalf("a change to the role alone was refused as no changes: %v", err)
	}
	if err != nil {
		t.Fatalf("second PublishAgency: %v", err)
	}
	return publication
}

func publishedRoleOf(t *testing.T, publication models.AgencyPublication, id string) models.DocumentRole {
	t.Helper()
	for _, r := range publication.Document.Roles {
		if r.ID == id {
			return r
		}
	}
	t.Fatalf("role %s is not in the publication", id)
	return models.DocumentRole{}
}

func TestPublishAcceptsAPermissionsOnlyChange(t *testing.T) {
	p := newPublishedRoleWalk(t, []string{"report.publish"}, false)
	p.change(t, func(r *models.Role) { r.Permissions = []string{"report.publish", "mount.list"} })
	got := publishedRoleOf(t, p.publishSecond(t), p.role.ID)
	if len(got.Permissions) != 2 || got.Permissions[1] != "mount.list" {
		t.Fatalf("the published role lacks mount.list: %v", got.Permissions)
	}
}

func TestPublishAcceptsDroppingEveryPermission(t *testing.T) {
	p := newPublishedRoleWalk(t, []string{"mount.list"}, false)
	p.change(t, func(r *models.Role) { r.Permissions = nil })
	if got := publishedRoleOf(t, p.publishSecond(t), p.role.ID); len(got.Permissions) != 0 {
		t.Fatalf("the published role still has %v", got.Permissions)
	}
}

func TestPublishAcceptsAStaffOnlyChange(t *testing.T) {
	p := newPublishedRoleWalk(t, nil, false)
	p.change(t, func(r *models.Role) { r.Staff = true })
	if got := publishedRoleOf(t, p.publishSecond(t), p.role.ID); !got.Staff {
		t.Fatal("the published role is not staff")
	}
}

func TestPublishStillRefusesAnUnchangedDraft(t *testing.T) {
	p := newPublishedRoleWalk(t, []string{"mount.list"}, true)
	if _, err := p.mgr.PublishAgency(p.ctx, p.draftID, "", ""); !errors.Is(err, mwanachamaagency.ErrNoChangesDetected) {
		t.Fatalf("an unchanged draft published again: %v", err)
	}
}
