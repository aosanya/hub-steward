package http

import (
	"context"
	"net/http"
	"slices"
	"testing"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type publishedPermissionsWalk struct {
	stepRunWalk
	reader *http.Cookie
}

func newPublishedPermissionsWalk(t *testing.T, codes []string) publishedPermissionsWalk {
	t.Helper()
	w := newStepRunWalk(t, []stepSpec{{title: "Read the board", form: "Board", role: "Reader", questions: boardQuestions}}, "Reader")
	p := publishedPermissionsWalk{stepRunWalk: w, reader: w.people["Reader"]}
	p.setDraftPermissions(t, codes)
	p.publish(t)
	return p
}

func (p publishedPermissionsWalk) setDraftPermissions(t *testing.T, codes []string) {
	t.Helper()
	ctx := context.Background()
	mgr, err := p.deps.Registry.AgencyManager(ctx, p.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	if _, err := mgr.SetRolePermissions(ctx, p.roles["Reader"], codes); err != nil {
		t.Fatalf("SetRolePermissions: %v", err)
	}
}

func (p publishedPermissionsWalk) held(t *testing.T) []string {
	t.Helper()
	rec := p.call(t, "GET", "/instances/"+p.instance+"/my-roles", nil, p.reader)
	if rec.Code != http.StatusOK {
		t.Fatalf("my-roles: %d %s", rec.Code, rec.Body.String())
	}
	raw, ok := decodeObject(t, rec)["permissions"].([]any)
	if !ok {
		t.Fatalf("permissions missing or not a list in %s", rec.Body.String())
	}
	out := make([]string, 0, len(raw))
	for _, c := range raw {
		out = append(out, c.(string))
	}
	return out
}

func TestARolePublishedWithACodeGrantsIt(t *testing.T) {
	p := newPublishedPermissionsWalk(t, []string{"task.read"})
	if got := p.held(t); !slices.Equal(got, []string{"task.read"}) {
		t.Fatalf("held = %v, want [task.read]", got)
	}
}

func TestADraftEditThatAddsACodeGrantsNothingUntilThePublish(t *testing.T) {
	p := newPublishedPermissionsWalk(t, []string{"task.read"})
	p.setDraftPermissions(t, []string{"task.read", "backlog.manage"})
	if got := p.held(t); !slices.Equal(got, []string{"task.read"}) {
		t.Fatalf("held before the publish = %v, want [task.read]", got)
	}
	p.publish(t)
	if got := p.held(t); !slices.Equal(got, []string{"backlog.manage", "task.read"}) {
		t.Fatalf("held after the publish = %v, want [backlog.manage task.read]", got)
	}
}

func TestADraftEditThatRemovesACodeTakesNothingAwayUntilThePublish(t *testing.T) {
	p := newPublishedPermissionsWalk(t, []string{"task.read", "backlog.manage"})
	p.setDraftPermissions(t, []string{"task.read"})
	if got := p.held(t); !slices.Equal(got, []string{"backlog.manage", "task.read"}) {
		t.Fatalf("held before the publish = %v, want [backlog.manage task.read]", got)
	}
	p.publish(t)
	if got := p.held(t); !slices.Equal(got, []string{"task.read"}) {
		t.Fatalf("held after the publish = %v, want [task.read]", got)
	}
}

func TestTheRolesOfAnAgencyNeverPublishedGrantNothing(t *testing.T) {
	w := newStepRunWalk(t, nil)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	draft, err := mgr.CreateDraft(ctx, "never published", "", "")
	if err != nil {
		t.Fatalf("CreateDraft: %v", err)
	}
	role, err := mgr.CreateRole(ctx, agencymodels.Role{DraftID: draft.ID, Name: "Reader", Permissions: []string{"task.read"}})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	got, err := w.deps.agencyRolePermissions(withPartitionContext(ctx, w.instance), role.ID)
	if err != nil {
		t.Fatalf("agencyRolePermissions: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("a role of an agency never published grants %v, want nothing", got)
	}
}

func TestARoleOfNoDraftIsStillUnknown(t *testing.T) {
	w := newStepRunWalk(t, nil)
	if _, err := w.deps.agencyRolePermissions(withPartitionContext(context.Background(), w.instance), "no-such-role"); err == nil {
		t.Fatal("a role that exists nowhere was accepted")
	}
}
