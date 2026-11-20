package agencies

import (
	"context"
	"errors"
	"reflect"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
)

type groupRoleFixture struct {
	reg        *registry
	instanceID string
	actors     mwanachamaactor.UserManager
	hierarchy  string
	level      string
}

func newGroupRoleFixture(t *testing.T) groupRoleFixture {
	t.Helper()
	ctx := context.Background()
	built, err := NewRegistry(sharedMemoryDB(t))
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	reg := built.(*registry)
	inst, err := reg.CreateInstance(ctx, "Town")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	actors, err := reg.ActorManager(ctx, inst.ID)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	hierarchy, err := actors.CreateHierarchy(ctx, mwanachamaactor.Hierarchy{Name: "Council"})
	if err != nil {
		t.Fatalf("CreateHierarchy: %v", err)
	}
	level, err := actors.CreateLevel(ctx, mwanachamaactor.Level{HierarchyID: hierarchy.ID, Name: "Club"})
	if err != nil {
		t.Fatalf("CreateLevel: %v", err)
	}
	return groupRoleFixture{reg: reg, instanceID: inst.ID, actors: actors, hierarchy: hierarchy.ID, level: level.ID}
}

func (f groupRoleFixture) group(t *testing.T, name, joinMode string) string {
	t.Helper()
	g, err := f.actors.CreateGroup(context.Background(), mwanachamaactor.Group{Name: name, HierarchyID: f.hierarchy, LevelID: f.level, JoinMode: joinMode})
	if err != nil {
		t.Fatalf("CreateGroup %s: %v", name, err)
	}
	return g.ID
}

func (f groupRoleFixture) actor(t *testing.T, name string, groupIDs ...string) string {
	t.Helper()
	ctx := context.Background()
	a, err := f.actors.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
	if err != nil {
		t.Fatalf("CreateActor %s: %v", name, err)
	}
	for _, g := range groupIDs {
		if _, err := f.actors.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: a.ID, GroupID: g}); err != nil {
			t.Fatalf("AssignGroup %s: %v", name, err)
		}
	}
	return a.ID
}

func TestGroupRoleWritesRefuseAnyBlankPart(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	cases := []struct{ instance, group, role string }{
		{"", "g", "r"}, {id, "", "r"}, {id, "g", ""}, {id, "  ", "r"}, {id, "g", "\t"},
	}
	for _, c := range cases {
		if err := reg.GiveGroupRole(ctx, c.instance, c.group, c.role); !errors.Is(err, ErrGroupRoleInvalid) {
			t.Errorf("give %+v: %v", c, err)
		}
		if err := reg.TakeGroupRole(ctx, c.instance, c.group, c.role); !errors.Is(err, ErrGroupRoleInvalid) {
			t.Errorf("take %+v: %v", c, err)
		}
	}
	listed, err := reg.ListGroupRoles(ctx, id)
	if err != nil || len(listed) != 0 {
		t.Fatalf("nothing may be stored after refusals: %v %v", listed, err)
	}
}

func TestGivingAGroupRoleTwiceKeepsOneRowAndTrimsTheIDs(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	if err := reg.GiveGroupRole(ctx, " "+id+" ", " g1 ", " treasurer "); err != nil {
		t.Fatalf("give: %v", err)
	}
	if err := reg.GiveGroupRole(ctx, id, "g1", "treasurer"); err != nil {
		t.Fatalf("giving the same role again must be a no-op: %v", err)
	}
	ids, err := reg.GroupRoleIDs(ctx, id, "g1")
	if err != nil || !reflect.DeepEqual(ids, []string{"treasurer"}) {
		t.Fatalf("role ids = %v, %v", ids, err)
	}
}

func TestGroupRoleIDsAreSortedAndEmptyNeverNil(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	for _, role := range []string{"viewer", "agent", "manager"} {
		if err := reg.GiveGroupRole(ctx, id, "g1", role); err != nil {
			t.Fatalf("give %s: %v", role, err)
		}
	}
	ids, err := reg.GroupRoleIDs(ctx, id, "g1")
	if err != nil || !reflect.DeepEqual(ids, []string{"agent", "manager", "viewer"}) {
		t.Fatalf("role ids = %v, %v", ids, err)
	}
	for _, c := range [][2]string{{id, "other-group"}, {"", "g1"}, {id, " "}} {
		got, err := reg.GroupRoleIDs(ctx, c[0], c[1])
		if err != nil || got == nil || len(got) != 0 {
			t.Errorf("GroupRoleIDs(%q,%q) = %#v, %v; want a non-nil empty list", c[0], c[1], got, err)
		}
	}
}

func TestListingGroupRolesIsOrderedByGroupThenRoleAndScopedToTheInstance(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	other, err := reg.CreateInstance(ctx, "Other")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	for _, c := range [][3]string{{id, "g2", "a"}, {id, "g1", "z"}, {id, "g1", "b"}, {other.ID, "g1", "elsewhere"}} {
		if err := reg.GiveGroupRole(ctx, c[0], c[1], c[2]); err != nil {
			t.Fatalf("give %v: %v", c, err)
		}
	}
	listed, err := reg.ListGroupRoles(ctx, id)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	var got [][2]string
	for _, row := range listed {
		if row.InstanceID != id {
			t.Errorf("row of another instance listed: %+v", row)
		}
		if row.CreatedAt.IsZero() {
			t.Errorf("created time missing: %+v", row)
		}
		got = append(got, [2]string{row.GroupID, row.AgencyRoleID})
	}
	want := [][2]string{{"g1", "b"}, {"g1", "z"}, {"g2", "a"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("listed = %v, want %v", got, want)
	}
	none, err := reg.ListGroupRoles(ctx, "nobody")
	if err != nil || none == nil || len(none) != 0 {
		t.Fatalf("an unknown instance lists %#v, %v; want an empty list", none, err)
	}
}

func TestTakingAGroupRoleRemovesOnlyThatRole(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	for _, c := range [][2]string{{"g1", "a"}, {"g1", "b"}, {"g2", "a"}} {
		if err := reg.GiveGroupRole(ctx, id, c[0], c[1]); err != nil {
			t.Fatalf("give: %v", err)
		}
	}
	if err := reg.TakeGroupRole(ctx, id, "g1", "a"); err != nil {
		t.Fatalf("take: %v", err)
	}
	if err := reg.TakeGroupRole(ctx, id, "g1", "never-given"); err != nil {
		t.Fatalf("taking a role that is not held must not fail: %v", err)
	}
	g1, _ := reg.GroupRoleIDs(ctx, id, "g1")
	g2, _ := reg.GroupRoleIDs(ctx, id, "g2")
	if !reflect.DeepEqual(g1, []string{"b"}) || !reflect.DeepEqual(g2, []string{"a"}) {
		t.Fatalf("g1 = %v, g2 = %v", g1, g2)
	}
}

func TestRolesThroughGroupsCountOnlyInviteOnlyGroupsTheCallerIsIn(t *testing.T) {
	f := newGroupRoleFixture(t)
	ctx := context.Background()
	board := f.group(t, "Board", "confirmed")
	committee := f.group(t, "Committee", "confirmed")
	openClub := f.group(t, "Open club", "open")
	notMine := f.group(t, "Not mine", "confirmed")
	grants := []struct{ group, role string }{
		{board, "treasurer"}, {board, "auditor"}, {committee, "auditor"}, {openClub, "everyone-admin"}, {notMine, "secret"},
	}
	for _, g := range grants {
		if err := f.reg.GiveGroupRole(ctx, f.instanceID, g.group, g.role); err != nil {
			t.Fatalf("give %+v: %v", g, err)
		}
	}
	caller := f.actor(t, "Amina", board, committee, openClub)
	got, err := f.reg.RoleIDsThroughGroups(ctx, f.instanceID, caller)
	if err != nil {
		t.Fatalf("RoleIDsThroughGroups: %v", err)
	}
	want := []string{"auditor", "treasurer"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("roles = %v, want %v (sorted, deduplicated, none from an open or foreign group)", got, want)
	}
}

func TestRolesThroughGroupsAreEmptyWhenNoGroupQualifies(t *testing.T) {
	f := newGroupRoleFixture(t)
	ctx := context.Background()
	openClub := f.group(t, "Open club", "open")
	if err := f.reg.GiveGroupRole(ctx, f.instanceID, openClub, "admin"); err != nil {
		t.Fatalf("give: %v", err)
	}
	loner := f.actor(t, "Loner")
	inOpenOnly := f.actor(t, "Joiner", openClub)
	for name, caller := range map[string]string{"no groups": loner, "only an open group": inOpenOnly, "unknown caller": "ghost", "blank caller": ""} {
		got, err := f.reg.RoleIDsThroughGroups(ctx, f.instanceID, caller)
		if err != nil || got == nil || len(got) != 0 {
			t.Errorf("%s: %#v, %v; want a non-nil empty list", name, got, err)
		}
	}
}

func TestRolesThroughGroupsFailForAnUnknownInstance(t *testing.T) {
	reg, _ := registryWithMembers(t, nil)
	if _, err := reg.RoleIDsThroughGroups(context.Background(), "ghost", "someone"); err == nil {
		t.Fatal("an unknown instance must surface its error, not an empty list")
	}
}

func TestGroupExistsAnswersFalseForAMissingGroupAndErrorsForAMissingInstance(t *testing.T) {
	f := newGroupRoleFixture(t)
	ctx := context.Background()
	real := f.group(t, "Board", "confirmed")
	exists := f.reg.groupExistsIn(f.instanceID)
	if ok, err := exists(ctx, real); err != nil || !ok {
		t.Fatalf("existing group: %v, %v", ok, err)
	}
	if ok, err := exists(ctx, "no-such-group"); err != nil || ok {
		t.Fatalf("missing group: %v, %v", ok, err)
	}
	if _, err := f.reg.groupExistsIn("ghost")(ctx, real); err == nil {
		t.Fatal("an unknown instance must be an error")
	}
}

func TestGroupsOfListsEachHeldGroupOnceAndSkipsBlankCallers(t *testing.T) {
	f := newGroupRoleFixture(t)
	ctx := context.Background()
	a, b := f.group(t, "A", "confirmed"), f.group(t, "B", "confirmed")
	caller := f.actor(t, "Chiku", a, b, a)
	got, err := f.reg.groupsOf(ctx, f.instanceID, caller)
	if err != nil {
		t.Fatalf("groupsOf: %v", err)
	}
	if len(got) != 2 || !(got[0] == a && got[1] == b || got[0] == b && got[1] == a) {
		t.Fatalf("groups = %v, want %s and %s once each", got, a, b)
	}
	for _, c := range [][2]string{{"", caller}, {f.instanceID, ""}} {
		if got, err := f.reg.groupsOf(ctx, c[0], c[1]); err != nil || len(got) != 0 {
			t.Errorf("groupsOf(%q,%q) = %v, %v; want nothing", c[0], c[1], got, err)
		}
	}
	if _, err := f.reg.groupsOf(ctx, "ghost", caller); err == nil {
		t.Fatal("an unknown instance must be an error")
	}
}
