package http

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strings"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"

	"wakalaserver/internal/accounts"
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
	g, err := w.directory(t).CreateGroup(context.Background(), mwanachamaactor.Group{Name: name + " group"})
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

func (w groupRoleWalk) groupRolesPath() string { return "/instances/" + w.instance + "/group-roles" }

func TestGroupRoles_TheOwnerGivesAndTakesAGroupRoleThroughTheRoutes(t *testing.T) {
	w := newGroupRoleWalk(t)
	_, amina := w.resident(t, "Amina", "Support")
	group := w.group(t, "Support")

	rec := w.call(t, "POST", w.groupRolesPath(), map[string]any{"group_id": group, "agency_role_id": w.roles["Reader"]}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("owner gives the role: %d %s", rec.Code, rec.Body.String())
	}
	if code := w.list(t, amina); code != http.StatusOK {
		t.Fatalf("after the role is given: %d, want 200", code)
	}
	rec = w.call(t, "GET", w.groupRolesPath()+"?group_id="+group, nil, w.owner)
	items, _ := decodeObject(t, rec)["items"].([]any)
	if rec.Code != http.StatusOK || len(items) != 1 {
		t.Fatalf("list the group's roles: %d %s", rec.Code, rec.Body.String())
	}
	if first, _ := items[0].(map[string]any); first["role_name"] != "Reader" || first["group_id"] != group {
		t.Fatalf("listed group role = %v, want the group and the role name Reader", items[0])
	}
	rec = w.call(t, "DELETE", w.groupRolesPath()+"/"+group+"/"+w.roles["Reader"], nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("owner takes the role: %d %s", rec.Code, rec.Body.String())
	}
	if code := w.list(t, amina); code != http.StatusNotFound {
		t.Fatalf("after the role is taken: %d, want 404", code)
	}
}

func TestGroupRoles_OnlyTheOwnerHandsOutGroupRoles(t *testing.T) {
	w := newGroupRoleWalk(t)
	group := w.group(t, "Support")
	body := map[string]any{"group_id": group, "agency_role_id": w.roles["Reader"]}

	agent := w.cookieFor(t, "agent-manager")
	if rec := w.call(t, "POST", "/instances/"+w.instance+"/agents", map[string]any{"user_id": "agent-manager"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds the agent: %d", rec.Code)
	}
	if rec := w.call(t, "POST", w.groupRolesPath(), body, agent); rec.Code != http.StatusForbidden {
		t.Fatalf("an agent gives a group role: %d, want 403", rec.Code)
	}
	_, resident := w.resident(t, "Amina", "Support")
	if rec := w.call(t, "POST", w.groupRolesPath(), body, resident); rec.Code != http.StatusNotFound {
		t.Fatalf("a resident gives a group role: %d, want 404", rec.Code)
	}
	stranger := w.cookieFor(t, "a-stranger")
	if rec := w.call(t, "GET", w.groupRolesPath(), nil, stranger); rec.Code != http.StatusNotFound {
		t.Fatalf("a stranger lists group roles: %d, want 404", rec.Code)
	}
}

func TestGroupRoles_AGroupRoleNeedsARealGroupAndARealRole(t *testing.T) {
	w := newGroupRoleWalk(t)
	group := w.group(t, "Support")
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		if roleID == w.roles["Reader"] {
			return []string{"task.read"}, nil
		}
		return nil, errUnknownAgencyRole
	}
	if rec := w.call(t, "POST", w.groupRolesPath(), map[string]any{"group_id": "no-such-group", "agency_role_id": w.roles["Reader"]}, w.owner); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("unknown group: %d %s, want 422", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", w.groupRolesPath(), map[string]any{"group_id": group, "agency_role_id": "no-such-role"}, w.owner); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("unknown role: %d %s, want 422", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", w.groupRolesPath(), map[string]any{"group_id": group}, w.owner); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("no role: %d %s, want 422", rec.Code, rec.Body.String())
	}
}

func (w groupRoleWalk) backlogRoles(t *testing.T) (member, worker string) {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	m, err := mgr.CreateRole(ctx, agencymodels.Role{DraftID: w.draftID, Name: "Backlog member", Permissions: []string{"task.read"}})
	if err != nil {
		t.Fatalf("CreateRole member: %v", err)
	}
	k, err := mgr.CreateRole(ctx, agencymodels.Role{DraftID: w.draftID, Name: "Backlog worker", Permissions: []string{"task.read", "task.edit"}})
	if err != nil {
		t.Fatalf("CreateRole worker: %v", err)
	}
	w.publish(t)
	perms := map[string][]string{m.ID: {"task.read"}, k.ID: {"task.read", "task.edit"}}
	before := w.deps.rolePermissionsOverride
	w.deps.rolePermissionsOverride = func(ctx context.Context, roleID string) ([]string, error) {
		if codes, ok := perms[roleID]; ok {
			return codes, nil
		}
		return before(ctx, roleID)
	}
	return m.ID, k.ID
}

func (w groupRoleWalk) tm(path string) string {
	return "/instances/" + w.instance + "/taskmanager" + path
}

func (w groupRoleWalk) access(t *testing.T, backlog, group string) map[string]any {
	t.Helper()
	rec := w.call(t, "GET", w.tm("/backlogs/"+backlog+"/access"), nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("list access: %d %s", rec.Code, rec.Body.String())
	}
	groups, _ := decodeObject(t, rec)["groups"].([]any)
	for _, g := range groups {
		if m, ok := g.(map[string]any); ok && m["group_id"] == group {
			return m
		}
	}
	return nil
}

func TestGroupRoles_GivingAccessAlsoGivesTheMatchingRoleAndTakingItAwayTakesTheRoleAway(t *testing.T) {
	w := newGroupRoleWalk(t)
	member, worker := w.backlogRoles(t)
	staff, support := w.group(t, "Staff"), w.group(t, "Support")
	_, amina := w.resident(t, "Amina", "Support")

	if rec := w.call(t, "PUT", w.tm("/backlog-owner-group"), map[string]any{"group_id": staff}, w.owner); rec.Code != http.StatusNoContent {
		t.Fatalf("set owner group: %d %s", rec.Code, rec.Body.String())
	}
	if code := w.list(t, amina); code != http.StatusNotFound {
		t.Fatalf("before any access: %d, want 404", code)
	}

	if rec := w.call(t, "PUT", w.tm("/backlogs/backlog/access/"+support), map[string]any{"level": "see"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("give Can see: %d %s", rec.Code, rec.Body.String())
	}
	held, _ := w.deps.Registry.(agencies.GroupRoles).GroupRoleIDs(context.Background(), w.instance, support)
	if !slices.Equal(held, []string{member}) {
		t.Fatalf("after Can see the group holds %v, want only the Backlog member role %s", held, member)
	}
	if got := w.access(t, "backlog", support); got == nil || got["no_role"] == true || got["role_too_small"] == true {
		t.Fatalf("access entry after Can see = %v, want a role and no warning", got)
	}
	if code := w.list(t, amina); code != http.StatusOK {
		t.Fatalf("after Can see: list %d, want 200", code)
	}
	if code := w.create(t, amina); code != http.StatusForbidden {
		t.Fatalf("after Can see: create %d, want 403", code)
	}

	if rec := w.call(t, "PUT", w.tm("/backlogs/backlog/access/"+support), map[string]any{"level": "move"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("give Can move: %d %s", rec.Code, rec.Body.String())
	}
	held, _ = w.deps.Registry.(agencies.GroupRoles).GroupRoleIDs(context.Background(), w.instance, support)
	if !slices.Equal(held, []string{worker}) {
		t.Fatalf("after Can move the group holds %v, want only the Backlog worker role %s", held, worker)
	}
	if code := w.create(t, amina); code != http.StatusCreated {
		t.Fatalf("after Can move: create %d, want 201", code)
	}

	if rec := w.call(t, "DELETE", w.tm("/backlogs/backlog/access/"+support), nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("take access: %d %s", rec.Code, rec.Body.String())
	}
	held, _ = w.deps.Registry.(agencies.GroupRoles).GroupRoleIDs(context.Background(), w.instance, support)
	if len(held) != 0 {
		t.Fatalf("after the last access is taken the group still holds %v", held)
	}
	if code := w.list(t, amina); code != http.StatusNotFound {
		t.Fatalf("after access and role are taken: %d, want 404", code)
	}
}

func TestGroupRoles_AReadOnlyRoleWithCanMoveCanOnlyLook(t *testing.T) {
	w := newGroupRoleWalk(t)
	member, _ := w.backlogRoles(t)
	staff, support := w.group(t, "Staff"), w.group(t, "Support")
	_, amina := w.resident(t, "Amina", "Support")
	if rec := w.call(t, "PUT", w.tm("/backlog-owner-group"), map[string]any{"group_id": staff}, w.owner); rec.Code != http.StatusNoContent {
		t.Fatalf("set owner group: %d", rec.Code)
	}
	if rec := w.call(t, "PUT", w.tm("/backlogs/backlog/access/"+support), map[string]any{"level": "move"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("give Can move: %d %s", rec.Code, rec.Body.String())
	}
	held := w.deps.Registry.(agencies.GroupRoles)
	ctx := context.Background()
	ids, _ := held.GroupRoleIDs(ctx, w.instance, support)
	for _, id := range ids {
		if err := held.TakeGroupRole(ctx, w.instance, support, id); err != nil {
			t.Fatalf("TakeGroupRole: %v", err)
		}
	}
	if err := held.GiveGroupRole(ctx, w.instance, support, member); err != nil {
		t.Fatalf("GiveGroupRole: %v", err)
	}

	entry := w.access(t, "backlog", support)
	if entry == nil || entry["role_too_small"] != true {
		t.Fatalf("access entry = %v, want role_too_small", entry)
	}
	if code := w.list(t, amina); code != http.StatusOK {
		t.Fatalf("a read-only role with Can move lists: %d, want 200", code)
	}
	if code := w.create(t, amina); code != http.StatusForbidden {
		t.Fatalf("a read-only role with Can move creates: %d, want 403", code)
	}
}

func TestGroupRoles_TheHighestLevelAcrossAPersonsGroupsWins(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.backlogRoles(t)
	staff, support, dev := w.group(t, "Staff"), w.group(t, "Support"), w.group(t, "Dev")
	_, kofi := w.resident(t, "Kofi", "Support", "Dev")
	if rec := w.call(t, "PUT", w.tm("/backlog-owner-group"), map[string]any{"group_id": staff}, w.owner); rec.Code != http.StatusNoContent {
		t.Fatalf("set owner group: %d", rec.Code)
	}
	for group, level := range map[string]string{support: "see", dev: "move"} {
		if rec := w.call(t, "PUT", w.tm("/backlogs/backlog/access/"+group), map[string]any{"level": level}, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("give %s: %d %s", level, rec.Code, rec.Body.String())
		}
	}
	if code := w.create(t, kofi); code != http.StatusCreated {
		t.Fatalf("in Support (Can see) and Dev (Can move): create %d, want 201", code)
	}
}

func (w groupRoleWalk) toolRefusal(t *testing.T, person, action string) error {
	t.Helper()
	raw := []byte(`{"instance_id":"` + w.instance + `"}`)
	return w.deps.taskToolRefusal(accounts.WithID(context.Background(), person), raw, action)
}

func TestGroupRoles_AReaderWhoMovesAnIssueIsToldTheRoleIsTooSmall(t *testing.T) {
	w := newGroupRoleWalk(t)
	w.giveRole(t, "Members", "Reader")
	w.giveRole(t, "Workers", "Worker")
	member, _ := w.resident(t, "Mia", "Members")
	worker, _ := w.resident(t, "Wanda", "Workers")
	err := w.toolRefusal(t, member, "taskmanager.task.move_to_step")
	if err == nil || !strings.Contains(err.Error(), "role is too small to move issues") {
		t.Fatalf("a reader moving an issue is told %v, want the role is too small to move issues", err)
	}
	if !errors.Is(err, mwanachamataskmanager.ErrBacklogForbidden) {
		t.Fatalf("a reader moving an issue gets %v, want a backlog access refusal", err)
	}
	if err := w.toolRefusal(t, worker, "taskmanager.task.move_to_step"); err != nil {
		t.Fatalf("a worker moving an issue is refused: %v", err)
	}
}

func TestGroupRoles_ACanMoveGroupWithAReadOnlyRoleIsBlamedOnTheRoleNotTheLevel(t *testing.T) {
	w := newGroupRoleWalk(t)
	member, _ := w.backlogRoles(t)
	staff, support := w.group(t, "Staff"), w.group(t, "Support")
	amina, _ := w.resident(t, "Amina", "Support")
	if rec := w.call(t, "PUT", w.tm("/backlog-owner-group"), map[string]any{"group_id": staff}, w.owner); rec.Code != http.StatusNoContent {
		t.Fatalf("set owner group: %d", rec.Code)
	}
	if rec := w.call(t, "PUT", w.tm("/backlogs/backlog/access/"+support), map[string]any{"level": "move"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("give Can move: %d %s", rec.Code, rec.Body.String())
	}
	held := w.deps.Registry.(agencies.GroupRoles)
	ctx := context.Background()
	ids, _ := held.GroupRoleIDs(ctx, w.instance, support)
	for _, id := range ids {
		if err := held.TakeGroupRole(ctx, w.instance, support, id); err != nil {
			t.Fatalf("TakeGroupRole: %v", err)
		}
	}
	if err := held.GiveGroupRole(ctx, w.instance, support, member); err != nil {
		t.Fatalf("GiveGroupRole: %v", err)
	}
	err := w.toolRefusal(t, amina, "taskmanager.task.move_to_step")
	if err == nil || !strings.Contains(err.Error(), "your role is too small to move issues") {
		t.Fatalf("a Can move group with a read-only role is told %v, want the role is too small to move issues", err)
	}
	if strings.Contains(err.Error(), "Can move on both backlogs") {
		t.Fatalf("the refusal %q blames the level, which is Can move", err)
	}
	if !errors.Is(err, mwanachamataskmanager.ErrBacklogForbidden) {
		t.Fatalf("the refusal %v is not a backlog access refusal", err)
	}
}

func TestGroupRoles_APersonWhoCannotSeeTasksIsStillToldNothingAboutBacklogs(t *testing.T) {
	w := newGroupRoleWalk(t)
	amina, _ := w.resident(t, "Amina", "Support")
	for _, action := range []string{"taskmanager.task.move_to_step", "taskmanager.task.list"} {
		err := w.toolRefusal(t, amina, action)
		if !errors.Is(err, agencies.ErrInstanceNotFound) {
			t.Fatalf("a person with no role asking for %s gets %v, want instance not found", action, err)
		}
	}
}
