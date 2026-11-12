package mwanachamapermissions

import (
	"context"
	"errors"
	"testing"
)

func newRole(t *testing.T, m PermissionsManager, code string) {
	t.Helper()
	if _, err := m.CreateRole(context.Background(), Role{Code: code, Name: "Name of " + code}); err != nil {
		t.Fatal(err)
	}
}

func actionNames(t *testing.T, m PermissionsManager, code string) []string {
	t.Helper()
	list, err := m.ListActions(context.Background(), code)
	if err != nil {
		t.Fatal(err)
	}
	out := []string{}
	for _, a := range list {
		out = append(out, a.Action)
	}
	return out
}

func sameStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestCreateRoleRefusals(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	for name, r := range map[string]Role{
		"empty code":     {Name: "x"},
		"uppercase code": {Code: "Owner", Name: "x"},
		"dashed code":    {Code: "own-er", Name: "x"},
		"trailing under": {Code: "owner_", Name: "x"},
		"missing name":   {Code: "owner"},
		"leading digit":  {Code: "1owner", Name: "x"},
		"double under":   {Code: "a__b", Name: "x"},
	} {
		if _, err := m.CreateRole(ctx, r); !errors.Is(err, ErrInvalidRole) {
			t.Errorf("%s: want ErrInvalidRole, got %v", name, err)
		}
	}
	newRole(t, m, "owner")
	if _, err := m.CreateRole(ctx, Role{Code: "owner", Name: "again"}); !errors.Is(err, ErrDuplicateRole) {
		t.Fatalf("want ErrDuplicateRole, got %v", err)
	}
}

func TestCreateRoleIgnoresCallerSeededAndDeleted(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	got, err := m.CreateRole(ctx, Role{Code: "owner", Name: "Owner", Seeded: true, Deleted: true})
	if err != nil {
		t.Fatal(err)
	}
	if got.Seeded || got.Deleted || got.CreatedAt == "" || got.CreatedAt != got.UpdatedAt {
		t.Fatalf("server must own seeded, deleted and stamps: %+v", got)
	}
	read, err := m.GetRole(ctx, "owner")
	if err != nil || read.Seeded || read.Deleted {
		t.Fatalf("stored role differs: %+v %v", read, err)
	}
}

func TestGetRoleUnknownIsNotFound(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	if _, err := m.GetRole(context.Background(), "ghost"); !errors.Is(err, ErrRoleNotFound) {
		t.Fatalf("want ErrRoleNotFound, got %v", err)
	}
}

func TestUpdateRoleChangesNameAndDescriptionOnly(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	newRole(t, m, "owner")
	got, err := m.UpdateRole(ctx, Role{Code: "owner", Name: "Chief", Description: "runs it", Seeded: true})
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "Chief" || got.Description != "runs it" || got.Seeded {
		t.Fatalf("unexpected update result: %+v", got)
	}
	read, _ := m.GetRole(ctx, "owner")
	if read.Name != "Chief" || read.Description != "runs it" || read.Seeded {
		t.Fatalf("unexpected stored role: %+v", read)
	}
	if _, err := m.UpdateRole(ctx, Role{Code: "owner", Name: ""}); !errors.Is(err, ErrInvalidRole) {
		t.Fatalf("blank name: want ErrInvalidRole, got %v", err)
	}
	if _, err := m.UpdateRole(ctx, Role{Code: "ghost", Name: "x"}); !errors.Is(err, ErrRoleNotFound) {
		t.Fatalf("unknown role: want ErrRoleNotFound, got %v", err)
	}
}

func TestListRolesFilters(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	newRole(t, m, "owner")
	newRole(t, m, "viewer")
	if _, err := m.SeedActions(ctx, "viewer", []string{"a.read"}); err != nil {
		t.Fatal(err)
	}
	seeded, notSeeded := true, false

	list, _ := m.ListRoles(ctx, RoleFilter{Seeded: &seeded})
	if len(list) != 1 || list[0].Code != "viewer" {
		t.Fatalf("seeded filter: %+v", list)
	}
	list, _ = m.ListRoles(ctx, RoleFilter{Seeded: &notSeeded})
	if len(list) != 1 || list[0].Code != "owner" {
		t.Fatalf("not-seeded filter: %+v", list)
	}
	list, _ = m.ListRoles(ctx, RoleFilter{Name: "NAME OF OWN"})
	if len(list) != 1 || list[0].Code != "owner" {
		t.Fatalf("case-insensitive name filter: %+v", list)
	}
	list, _ = m.ListRoles(ctx, RoleFilter{Code: "viewer"})
	if len(list) != 1 || list[0].Code != "viewer" {
		t.Fatalf("code filter: %+v", list)
	}
}

func TestListRolesNameFilterTreatsWildcardsAsText(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	newRole(t, m, "owner")
	for _, wild := range []string{"%", "_", "!"} {
		list, err := m.ListRoles(ctx, RoleFilter{Name: wild})
		if err != nil || len(list) != 0 {
			t.Errorf("%q must match nothing literal, got %+v %v", wild, list, err)
		}
	}
}

func TestDeleteRoleRetiresItAndHidesItFromListings(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	newRole(t, m, "owner")
	if err := m.DeleteRole(ctx, "owner"); err != nil {
		t.Fatal(err)
	}
	list, _ := m.ListRoles(ctx, RoleFilter{})
	if len(list) != 0 {
		t.Fatalf("retired role listed: %+v", list)
	}
	read, err := m.GetRole(ctx, "owner")
	if err != nil || !read.Deleted {
		t.Fatalf("retired role is kept and flagged: %+v %v", read, err)
	}
	if _, err := m.AddAction(ctx, "owner", "a.read"); !errors.Is(err, ErrRoleRetired) {
		t.Fatalf("adding to a retired role: want ErrRoleRetired, got %v", err)
	}
	if err := m.DeleteRole(ctx, "ghost"); !errors.Is(err, ErrRoleNotFound) {
		t.Fatalf("want ErrRoleNotFound, got %v", err)
	}
}

func TestDeleteSeededRoleIsRefused(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	newRole(t, m, "owner")
	if _, err := m.SeedActions(ctx, "owner", []string{"a.read"}); err != nil {
		t.Fatal(err)
	}
	if err := m.DeleteRole(ctx, "owner"); !errors.Is(err, ErrSeededRole) {
		t.Fatalf("want ErrSeededRole, got %v", err)
	}
}

func TestAddActionRefusals(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	newRole(t, m, "owner")
	for _, bad := range []string{"", "read", "A.read", "a.", ".read", "a.Read", "a-b.read"} {
		if _, err := m.AddAction(ctx, "owner", bad); !errors.Is(err, ErrInvalidAction) {
			t.Errorf("%q: want ErrInvalidAction, got %v", bad, err)
		}
	}
	if _, err := m.AddAction(ctx, "ghost", "a.read"); !errors.Is(err, ErrRoleNotFound) {
		t.Errorf("unknown role: want ErrRoleNotFound, got %v", err)
	}
	if _, err := m.SeedActions(ctx, "owner", []string{"a.read"}); err != nil {
		t.Fatal(err)
	}
	if _, err := m.AddAction(ctx, "owner", "a.write"); !errors.Is(err, ErrSeededRole) {
		t.Errorf("seeded role: want ErrSeededRole, got %v", err)
	}
	if err := m.RemoveAction(ctx, "owner", "a.read"); !errors.Is(err, ErrSeededRole) {
		t.Errorf("remove from seeded: want ErrSeededRole, got %v", err)
	}
}

func TestAddActionIsIdempotentAndRemoveDropsIt(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	newRole(t, m, "owner")
	for i := 0; i < 2; i++ {
		if _, err := m.AddAction(ctx, "owner", "b.write"); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := m.AddAction(ctx, "owner", "a.read"); err != nil {
		t.Fatal(err)
	}
	if got := actionNames(t, m, "owner"); !sameStrings(got, []string{"a.read", "b.write"}) {
		t.Fatalf("actions sorted and distinct: %v", got)
	}
	if err := m.RemoveAction(ctx, "owner", "a.read"); err != nil {
		t.Fatal(err)
	}
	if got := actionNames(t, m, "owner"); !sameStrings(got, []string{"b.write"}) {
		t.Fatalf("after removal: %v", got)
	}
	if err := m.RemoveAction(ctx, "ghost", "a.read"); !errors.Is(err, ErrRoleNotFound) {
		t.Fatalf("want ErrRoleNotFound, got %v", err)
	}
}

func TestSetActionsReplacesWholeListAndDedupes(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	newRole(t, m, "owner")
	if _, err := m.AddAction(ctx, "owner", "old.thing"); err != nil {
		t.Fatal(err)
	}
	out, err := m.SetActions(ctx, "owner", []string{"b.write", "a.read", "b.write"})
	if err != nil || len(out) != 2 {
		t.Fatalf("set result %+v %v", out, err)
	}
	if got := actionNames(t, m, "owner"); !sameStrings(got, []string{"a.read", "b.write"}) {
		t.Fatalf("replaced list: %v", got)
	}
	read, _ := m.GetRole(context.Background(), "owner")
	if read.Seeded {
		t.Fatal("SetActions must not mark a role seeded")
	}
	if _, err := m.SetActions(ctx, "owner", []string{}); err != nil {
		t.Fatal(err)
	}
	if got := actionNames(t, m, "owner"); len(got) != 0 {
		t.Fatalf("an empty list clears: %v", got)
	}
}

func TestSetActionsRefusals(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	newRole(t, m, "owner")
	if _, err := m.AddAction(ctx, "owner", "keep.me"); err != nil {
		t.Fatal(err)
	}
	if _, err := m.SetActions(ctx, "owner", nil); !errors.Is(err, ErrActionsRequired) {
		t.Errorf("nil list: want ErrActionsRequired, got %v", err)
	}
	if _, err := m.SetActions(ctx, "owner", []string{"good.one", "bad"}); !errors.Is(err, ErrInvalidAction) {
		t.Errorf("bad member: want ErrInvalidAction, got %v", err)
	}
	if got := actionNames(t, m, "owner"); !sameStrings(got, []string{"keep.me"}) {
		t.Errorf("a refused set must leave the list alone: %v", got)
	}
	if _, err := m.SetActions(ctx, "ghost", []string{"a.b"}); !errors.Is(err, ErrRoleNotFound) {
		t.Errorf("unknown role: want ErrRoleNotFound, got %v", err)
	}
}

func TestSeedActionsMarksRoleSeededAndOverwrites(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	newRole(t, m, "viewer")
	if _, err := m.SeedActions(ctx, "viewer", []string{"a.read"}); err != nil {
		t.Fatal(err)
	}
	if _, err := m.SeedActions(ctx, "viewer", []string{"b.read"}); err != nil {
		t.Fatal(err)
	}
	read, _ := m.GetRole(ctx, "viewer")
	if !read.Seeded {
		t.Fatal("seeding marks the role seeded")
	}
	if got := actionNames(t, m, "viewer"); !sameStrings(got, []string{"b.read"}) {
		t.Fatalf("seeding replaces: %v", got)
	}
}

func TestSeedCreatesMissingRoleFromDeclaredOperations(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	ops := []byte(`{"operations":{
	  "b":{"method":"GET","path":"/b","call":"ListRoles","action":"mod.b.read","title":"B","description":"d","returns":[{"body":true}]},
	  "a":{"method":"GET","path":"/a","call":"ListRoles","action":"mod.a.read","title":"A","description":"d","returns":[{"body":true}]}}}`)
	out, err := m.Seed(ctx, "visitor", "Visitor", ops)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 2 {
		t.Fatalf("seeded actions: %+v", out)
	}
	if got := actionNames(t, m, "visitor"); !sameStrings(got, []string{"mod.a.read", "mod.b.read"}) {
		t.Fatalf("declared actions: %v", got)
	}
	role, err := m.GetRole(ctx, "visitor")
	if err != nil || role.Name != "Visitor" || !role.Seeded {
		t.Fatalf("created role: %+v %v", role, err)
	}
}

func TestSeedRefusesMalformedOperations(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	if _, err := m.Seed(context.Background(), "visitor", "Visitor", []byte(`not json`)); err == nil {
		t.Fatal("garbage operations must be refused")
	}
	if _, err := m.GetRole(context.Background(), "visitor"); !errors.Is(err, ErrRoleNotFound) {
		t.Fatal("a refused seed must not create the role")
	}
}

func TestDeclaredActionsMergesAndSorts(t *testing.T) {
	got, err := DeclaredActions()
	if err != nil || len(got) != 0 {
		t.Fatalf("no operations: %v %v", got, err)
	}
	real, err := DeclaredActions(Operations())
	if err != nil || len(real) == 0 {
		t.Fatalf("shipped operations: %v %v", real, err)
	}
	for i := 1; i < len(real); i++ {
		if real[i-1] >= real[i] {
			t.Fatalf("not sorted and distinct at %d: %q %q", i, real[i-1], real[i])
		}
	}
	twice, _ := DeclaredActions(Operations(), Operations())
	if !sameStrings(real, twice) {
		t.Fatal("the same file twice declares the same actions")
	}
}
