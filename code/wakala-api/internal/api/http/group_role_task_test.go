package http

import (
	"context"
	"net/http"
	"slices"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"

	"wakalaserver/internal/agencies"
)

type groupRoleWalk struct {
	stepRunWalk
	groups map[string]string
}

func newGroupRoleWalk(t *testing.T) groupRoleWalk {
	t.Helper()
	w := newStepRunWalk(t, []stepSpec{
		{title: "Read the board", form: "Read", role: "Reader", questions: boardQuestions},
		{title: "Work the board", form: "Work", role: "Worker", questions: boardQuestions},
		{title: "Manage the board", form: "Manage", role: "Manager", questions: boardQuestions},
	})
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
		if m.Code == "taskmanager" {
			if _, err := mgr.SetModuleEnabled(ctx, w.draftID, m.ID, true); err != nil {
				t.Fatalf("SetModuleEnabled: %v", err)
			}
		}
	}
	w.publish(t)
	agencyMountedSets.forget(w.instance)
	perms := map[string][]string{
		w.roles["Reader"]:  {"task.read"},
		w.roles["Worker"]:  {"task.read", "task.edit"},
		w.roles["Manager"]: {"task.read", "task.edit", "backlog.manage"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		return perms[roleID], nil
	}
	return groupRoleWalk{stepRunWalk: w, groups: map[string]string{}}
}

func (w groupRoleWalk) directory(t *testing.T) mwanachamaactor.UserManager {
	t.Helper()
	um, err := w.deps.Registry.ActorManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	return um
}

func (w groupRoleWalk) group(t *testing.T, name string) string {
	t.Helper()
	if id, ok := w.groups[name]; ok {
		return id
	}
	g, err := w.directory(t).CreateGroup(context.Background(), mwanachamaactor.Group{Name: name})
	if err != nil {
		t.Fatalf("CreateGroup %s: %v", name, err)
	}
	w.groups[name] = g.ID
	return g.ID
}

func (w groupRoleWalk) resident(t *testing.T, name string, groups ...string) (string, *http.Cookie) {
	t.Helper()
	ctx := context.Background()
	um := w.directory(t)
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	for _, g := range groups {
		if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: actor.ID, GroupID: w.group(t, g)}); err != nil {
			t.Fatalf("AssignGroup %s: %v", g, err)
		}
	}
	return actor.ID, w.cookieFor(t, actor.ID)
}

func (w groupRoleWalk) giveRole(t *testing.T, group, role string) {
	t.Helper()
	holder, ok := w.deps.Registry.(agencies.GroupRoles)
	if !ok {
		t.Fatal("the registry does not hold group roles")
	}
	if err := holder.GiveGroupRole(context.Background(), w.instance, w.group(t, group), w.roles[role]); err != nil {
		t.Fatalf("GiveGroupRole %s %s: %v", group, role, err)
	}
}

func (w groupRoleWalk) list(t *testing.T, as *http.Cookie) int {
	t.Helper()
	return w.call(t, "GET", "/instances/"+w.instance+"/taskmanager/tasks", nil, as).Code
}

func (w groupRoleWalk) create(t *testing.T, as *http.Cookie) int {
	t.Helper()
	return w.call(t, "POST", "/instances/"+w.instance+"/taskmanager/tasks", map[string]any{"title": "An issue"}, as).Code
}

func TestGroupRoles_AResidentWithNoRoleSeesNothing(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, amina := w.resident(t, "Amina", "Support")
	if code := w.list(t, amina); code != http.StatusNotFound {
		t.Fatalf("a resident whose group holds no role lists tasks: %d, want 404", code)
	}
	stranger := w.cookieFor(t, "a-stranger")
	if code := w.list(t, stranger); code != http.StatusNotFound {
		t.Fatalf("a stranger lists tasks: %d, want 404", code)
	}
	if code := w.list(t, w.owner); code != http.StatusOK {
		t.Fatalf("the owner lists tasks: %d, want 200", code)
	}
}

func TestGroupRoles_AGroupRoleOpensTheTaskModuleToItsMembers(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, reader := w.resident(t, "Amina", "Support")
	_, worker := w.resident(t, "Kofi", "Dev")
	w.giveRole(t, "Support", "Reader")
	w.giveRole(t, "Dev", "Worker")

	if code := w.list(t, reader); code != http.StatusOK {
		t.Fatalf("a reader group member lists tasks: %d, want 200", code)
	}
	if code := w.create(t, reader); code != http.StatusForbidden {
		t.Fatalf("a reader group member creates a task: %d, want 403", code)
	}
	if code := w.create(t, worker); code != http.StatusCreated {
		t.Fatalf("a worker group member creates a task: %d, want 201", code)
	}
	if code := w.list(t, worker); code != http.StatusOK {
		t.Fatalf("a worker group member lists tasks: %d, want 200", code)
	}
}

func TestGroupRoles_APersonInTwoGroupsHoldsTheUnionOfTheirRoles(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, both := w.resident(t, "Kofi", "Support", "Dev")
	w.giveRole(t, "Support", "Reader")
	if code := w.create(t, both); code != http.StatusForbidden {
		t.Fatalf("with only the reader group's role: create %d, want 403", code)
	}
	w.giveRole(t, "Dev", "Worker")
	if code := w.create(t, both); code != http.StatusCreated {
		t.Fatalf("with a reader and a worker group: create %d, want 201", code)
	}
}

func TestGroupRoles_LeavingTheGroupTakesTheRoleAway(t *testing.T) {
	w := newGroupRoleWalk(t)
	id, amina := w.resident(t, "Amina", "Support")
	w.giveRole(t, "Support", "Reader")
	if code := w.list(t, amina); code != http.StatusOK {
		t.Fatalf("before leaving: %d, want 200", code)
	}
	if _, _, err := w.directory(t).Deregister(context.Background(), id, w.group(t, "Support")); err != nil {
		t.Fatalf("Deregister: %v", err)
	}
	if code := w.list(t, amina); code != http.StatusNotFound {
		t.Fatalf("after leaving the group: %d, want 404", code)
	}
}

func TestGroupRoles_TakingTheRoleFromTheGroupClosesTheModule(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, amina := w.resident(t, "Amina", "Support")
	w.giveRole(t, "Support", "Reader")
	holder := w.deps.Registry.(agencies.GroupRoles)
	if err := holder.TakeGroupRole(context.Background(), w.instance, w.group(t, "Support"), w.roles["Reader"]); err != nil {
		t.Fatalf("TakeGroupRole: %v", err)
	}
	if code := w.list(t, amina); code != http.StatusNotFound {
		t.Fatalf("after the role is taken from the group: %d, want 404", code)
	}
}

func TestGroupRoles_MyRolesCountsTheRolesOfTheCallersGroups(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, kofi := w.resident(t, "Kofi", "Support", "Dev")
	w.giveRole(t, "Support", "Reader")
	w.giveRole(t, "Dev", "Worker")
	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-roles", nil, kofi)
	if rec.Code != http.StatusOK {
		t.Fatalf("my-roles: %d %s", rec.Code, rec.Body.String())
	}
	raw, _ := decodeObject(t, rec)["permissions"].([]any)
	got := make([]string, 0, len(raw))
	for _, c := range raw {
		got = append(got, c.(string))
	}
	slices.Sort(got)
	if !slices.Equal(got, []string{"task.edit", "task.read"}) {
		t.Fatalf("permissions = %v, want [task.edit task.read]", got)
	}
}
