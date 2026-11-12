package http

import (
	"context"
	"net/http"
	"slices"
	"testing"
	"time"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"

	"wakalaserver/internal/agencies"
)

type roleHolderActs struct {
	walk     stepRunWalk
	path     string
	mayor    *http.Cookie
	clerk    *http.Cookie
	nobody   *http.Cookie
	closedID string
	groupID  string
}

func newRoleHolderActs(t *testing.T) roleHolderActs {
	t.Helper()
	w := newStepRunWalk(t, []stepSpec{
		{title: "Mayor signs", form: "Sign", role: "Mayor", questions: boardQuestions},
		{title: "Clerk files", form: "File", role: "Clerk", questions: boardQuestions},
	}, "Mayor", "Clerk")
	enableModules(t, w, "forms", "voting")
	perms := map[string][]string{
		w.roles["Mayor"]: {"report.publish"},
		w.roles["Clerk"]: {"poll.run"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		return perms[roleID], nil
	}
	a := roleHolderActs{walk: w, path: "/instances/" + w.instance, mayor: w.people["Mayor"], clerk: w.people["Clerk"]}
	a.nobody = a.resident(t, "Nobody")
	a.groupID = a.createGroup(t, "Town hall")
	a.closedID = a.closedForm(t)
	return a
}

func enableModules(t *testing.T, w stepRunWalk, codes ...string) {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	mods, err := mgr.ListModules(ctx, w.draftID, mwanachamaagency.ModuleFilter{})
	if err != nil {
		t.Fatalf("ListModules: %v", err)
	}
	for _, m := range mods {
		if slices.Contains(codes, m.Code) {
			if _, err := mgr.SetModuleEnabled(ctx, w.draftID, m.ID, true); err != nil {
				t.Fatalf("SetModuleEnabled %s: %v", m.Code, err)
			}
		}
	}
	w.publish(t)
	agencyMountedSets.forget(w.instance)
}

func (a roleHolderActs) resident(t *testing.T, name string) *http.Cookie {
	t.Helper()
	ctx := context.Background()
	um, err := a.walk.deps.Registry.ActorManager(ctx, a.walk.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := a.walk.deps.Registry.AddMember(ctx, a.walk.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	return a.walk.cookieFor(t, actor.ID)
}

func (a roleHolderActs) createGroup(t *testing.T, name string) string {
	t.Helper()
	rec := a.walk.call(t, "POST", a.path+"/actor/groups", map[string]any{"name": name}, a.walk.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return id
}

func (a roleHolderActs) closedForm(t *testing.T) string {
	t.Helper()
	forms := a.path + "/forms/forms"
	closes := time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339)
	rec := a.walk.call(t, "POST", forms, map[string]any{"title": "Ward round", "audience": "member", "closes_at": closes}, a.walk.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create form: %d %s", rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	target := a.walk.call(t, "POST", forms+"/"+id+"/targets", map[string]any{"chapter_id": a.groupID}, a.walk.owner)
	if target.Code != http.StatusCreated {
		t.Fatalf("aim the form: %d %s", target.Code, target.Body.String())
	}
	steps := []struct {
		suffix, method string
		body           map[string]any
	}{
		{"/questions", "POST", map[string]any{"prompt": "How many", "answer_type": "free_text"}},
		{"/publish", "POST", map[string]any{}},
		{"/close", "POST", map[string]any{}},
	}
	for _, s := range steps {
		if rec := a.walk.call(t, s.method, forms+"/"+id+s.suffix, s.body, a.walk.owner); rec.Code >= 400 {
			t.Fatalf("%s: %d %s", s.suffix, rec.Code, rec.Body.String())
		}
	}
	return id
}

func (a roleHolderActs) publishReport(t *testing.T, as *http.Cookie) int {
	t.Helper()
	body := map[string]any{"git_path": "reports/ward.md", "git_commit": "abc1234"}
	return a.walk.call(t, "POST", a.path+"/forms/forms/"+a.closedID+"/results", body, as).Code
}

func (a roleHolderActs) runPoll(t *testing.T, as *http.Cookie) int {
	t.Helper()
	poll := map[string]any{
		"question": "Close Mill Row on Sundays?",
		"choices":  []map[string]any{{"label": "yes"}, {"label": "no"}},
		"opens_at": "2026-11-08T00:00:00Z", "closes_at": "2026-12-08T00:00:00Z",
		"group_ids": []string{a.groupID},
	}
	return a.walk.call(t, "POST", a.path+"/voting/polls", poll, as).Code
}

func TestRoleHolder_APersonHoldingTheReportRolePublishesAReport(t *testing.T) {
	a := newRoleHolderActs(t)
	if code := a.publishReport(t, a.mayor); code != http.StatusCreated {
		t.Fatalf("the holder of report.publish publishes a report: %d, want 201", code)
	}
}

func TestRoleHolder_APersonWithoutTheReportRoleIsRefusedPublishingAReport(t *testing.T) {
	a := newRoleHolderActs(t)
	for name, as := range map[string]*http.Cookie{"resident with no role": a.nobody, "holder of poll.run": a.clerk} {
		if code := a.publishReport(t, as); code < 400 || code >= 500 {
			t.Errorf("%s publishes a report: %d, want a 4xx refusal", name, code)
		}
	}
	if code := a.publishReport(t, a.walk.owner); code != http.StatusCreated {
		t.Fatalf("the owner publishes a report: %d, want 201", code)
	}
}

func TestRoleHolder_APersonHoldingThePollRoleRunsAPoll(t *testing.T) {
	a := newRoleHolderActs(t)
	if code := a.runPoll(t, a.clerk); code != http.StatusCreated {
		t.Fatalf("the holder of poll.run runs a poll: %d, want 201", code)
	}
}

func TestRoleHolder_APersonWithoutThePollRoleIsRefusedRunningAPoll(t *testing.T) {
	a := newRoleHolderActs(t)
	for name, as := range map[string]*http.Cookie{"resident with no role": a.nobody, "holder of report.publish": a.mayor} {
		if code := a.runPoll(t, as); code != http.StatusForbidden {
			t.Errorf("%s runs a poll: %d, want 403", name, code)
		}
	}
	if code := a.runPoll(t, a.walk.owner); code != http.StatusCreated {
		t.Fatalf("the owner runs a poll: %d, want 201", code)
	}
}
