package mwanachamapermissions

import (
	"context"
	"errors"
	"testing"

	"wakalaserver/modules/permissions/models"
)

func TestPermissionReadPrefersOverrideThenFallsBackToDefinition(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	if _, err := m.ReadPermission(ctx, "p1", "can_edit", "lead"); !errors.Is(err, ErrPermissionNotFound) {
		t.Fatalf("unset: want ErrPermissionNotFound, got %v", err)
	}
	def, err := m.SetPermissionDefinition(ctx, Permission{Partition: "p1", Permission: "can_edit", RoleKind: "lead", Held: true, SetBy: "forged"})
	if err != nil || def.Layer != models.PermissionLayerDefinition || def.SetBy != "" || def.SetAt == "" {
		t.Fatalf("definition: %+v %v", def, err)
	}
	got, _ := m.ReadPermission(ctx, "p1", "can_edit", "lead")
	if !got.Held || got.Layer != models.PermissionLayerDefinition {
		t.Fatalf("definition read: %+v", got)
	}
	if _, err := m.OverridePermission(ctx, Permission{Partition: "p1", Permission: "can_edit", RoleKind: "lead", Held: false, SetBy: "admin", Layer: models.PermissionLayerDefinition}); err != nil {
		t.Fatal(err)
	}
	got, _ = m.ReadPermission(ctx, "p1", "can_edit", "lead")
	if got.Held || got.Layer != models.PermissionLayerOverride || got.SetBy != "admin" {
		t.Fatalf("override must win and ignore the claimed layer: %+v", got)
	}
	if err := m.ClearPermissionOverride(ctx, "p1", "can_edit", "lead"); err != nil {
		t.Fatal(err)
	}
	got, _ = m.ReadPermission(ctx, "p1", "can_edit", "lead")
	if !got.Held || got.Layer != models.PermissionLayerDefinition {
		t.Fatalf("clearing the override restores the definition: %+v", got)
	}
}

func TestSettingTheSamePermissionTwiceUpdatesInPlace(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	for _, held := range []bool{true, false} {
		if _, err := m.SetPermissionDefinition(ctx, Permission{Partition: "p1", Permission: "can_edit", RoleKind: "lead", Held: held}); err != nil {
			t.Fatal(err)
		}
	}
	list, _ := m.ListPermissions(ctx, "p1")
	if len(list) != 1 || list[0].Held {
		t.Fatalf("one row, last write wins: %+v", list)
	}
}

func TestOverrideNeedsWhoSetIt(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	_, err := m.OverridePermission(context.Background(), Permission{Partition: "p1", Permission: "can_edit", RoleKind: "lead", Held: true})
	if !errors.Is(err, ErrInvalidPermission) {
		t.Fatalf("want ErrInvalidPermission, got %v", err)
	}
}

func TestPermissionKeyRefusals(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	cases := map[string]struct {
		partition, permission, kind string
		want                        error
	}{
		"blank partition": {"", "can_edit", "lead", ErrInvalidPartition},
		"bad partition":   {"-p", "can_edit", "lead", ErrInvalidPartition},
		"bad permission":  {"p1", "Can Edit", "lead", ErrInvalidPermission},
		"bad role kind":   {"p1", "can_edit", "", ErrInvalidPermission},
	}
	for name, c := range cases {
		if _, err := m.SetPermissionDefinition(ctx, Permission{Partition: c.partition, Permission: c.permission, RoleKind: c.kind}); !errors.Is(err, c.want) {
			t.Errorf("set %s: want %v, got %v", name, c.want, err)
		}
		if _, err := m.ReadPermission(ctx, c.partition, c.permission, c.kind); !errors.Is(err, c.want) {
			t.Errorf("read %s: want %v, got %v", name, c.want, err)
		}
		if err := m.ClearPermissionOverride(ctx, c.partition, c.permission, c.kind); !errors.Is(err, c.want) {
			t.Errorf("clear %s: want %v, got %v", name, c.want, err)
		}
	}
}

func TestListPermissionsMergesLayersWithOverrideWinning(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	set := func(layerOverride bool, permission, kind string, held bool) {
		p := Permission{Partition: "p1", Permission: permission, RoleKind: kind, Held: held, SetBy: "admin"}
		var err error
		if layerOverride {
			_, err = m.OverridePermission(ctx, p)
		} else {
			_, err = m.SetPermissionDefinition(ctx, p)
		}
		if err != nil {
			t.Fatal(err)
		}
	}
	set(false, "can_edit", "lead", true)
	set(true, "can_edit", "lead", false)
	set(false, "can_edit", "member", true)
	set(false, "can_move", "lead", true)
	set(false, "can_move", "lead", true)
	if _, err := m.SetPermissionDefinition(ctx, Permission{Partition: "p2", Permission: "can_edit", RoleKind: "lead", Held: true}); err != nil {
		t.Fatal(err)
	}

	list, err := m.ListPermissions(ctx, "p1")
	if err != nil {
		t.Fatal(err)
	}
	type line struct {
		permission, kind string
		held             bool
		layer            models.PermissionLayer
	}
	got := []line{}
	for _, p := range list {
		got = append(got, line{p.Permission, p.RoleKind, p.Held, p.Layer})
	}
	want := []line{
		{"can_edit", "lead", false, models.PermissionLayerOverride},
		{"can_edit", "member", true, models.PermissionLayerDefinition},
		{"can_move", "lead", true, models.PermissionLayerDefinition},
	}
	if len(got) != len(want) {
		t.Fatalf("merged list: %+v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("line %d: want %+v got %+v", i, want[i], got[i])
		}
	}
}

func TestListPermissionsPartitionGuardAndEmptyList(t *testing.T) {
	m := coverManager(t, coverSpecJSON)
	ctx := context.Background()
	if _, err := m.ListPermissions(ctx, ""); !errors.Is(err, ErrInvalidPartition) {
		t.Errorf("blank: want ErrInvalidPartition, got %v", err)
	}
	if _, err := m.ListPermissions(ctx, "-p"); !errors.Is(err, ErrInvalidPartition) {
		t.Errorf("bad: want ErrInvalidPartition, got %v", err)
	}
	list, err := m.ListPermissions(ctx, "p1")
	if err != nil || list == nil || len(list) != 0 {
		t.Errorf("nothing set is an empty non-nil list: %v %v", list, err)
	}
}

func TestPermissionCallsRefusedWhenDomainDeclaresNone(t *testing.T) {
	m := coverManager(t, coverSpecWithoutPermissionsJSON)
	ctx := context.Background()
	p := Permission{Partition: "p1", Permission: "can_edit", RoleKind: "lead", SetBy: "admin"}
	if _, err := m.SetPermissionDefinition(ctx, p); !errors.Is(err, ErrPermissionsNotDeclared) {
		t.Errorf("set: %v", err)
	}
	if _, err := m.OverridePermission(ctx, p); !errors.Is(err, ErrPermissionsNotDeclared) {
		t.Errorf("override: %v", err)
	}
	if err := m.ClearPermissionOverride(ctx, "p1", "can_edit", "lead"); !errors.Is(err, ErrPermissionsNotDeclared) {
		t.Errorf("clear: %v", err)
	}
	if _, err := m.ReadPermission(ctx, "p1", "can_edit", "lead"); !errors.Is(err, ErrPermissionsNotDeclared) {
		t.Errorf("read: %v", err)
	}
	if _, err := m.ListPermissions(ctx, "p1"); !errors.Is(err, ErrPermissionsNotDeclared) {
		t.Errorf("list: %v", err)
	}
}

func TestScopeAndPatternShapes(t *testing.T) {
	good := []string{"*", "module:x", "instance:abc-1/x", "record:mod/inst/id-1"}
	bad := []string{"", "x", "Module:x", "record:", "record:mod/inst", "record:Mod/inst/id", "module:", "module:a b"}
	for _, s := range good {
		if !isScope(s) {
			t.Errorf("%q should be a scope", s)
		}
	}
	for _, s := range bad {
		if isScope(s) {
			t.Errorf("%q should not be a scope", s)
		}
	}
	if isPartition("-x") || !isPartition("") || !isPartition("A1_b.c:d-e") {
		t.Error("partition shape")
	}
}

func TestConflictClassification(t *testing.T) {
	if classifyConflict(nil) != nil {
		t.Error("nil stays nil")
	}
	busy := errors.New("database is locked")
	if !errors.Is(classifyConflict(busy), ErrConflict) {
		t.Error("a busy database reads as a conflict")
	}
	plain := errors.New("disk on fire")
	if errors.Is(classifyConflict(plain), ErrConflict) {
		t.Error("other errors pass through")
	}
	if got := classifyConflict(ErrConflict); got != ErrConflict {
		t.Errorf("an existing conflict is not rewrapped: %v", got)
	}
}
