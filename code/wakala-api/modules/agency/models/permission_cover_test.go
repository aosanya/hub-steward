package models

import (
	"reflect"
	"testing"
)

func TestDistinctPermissions_KeepsFirstOccurrenceOrder(t *testing.T) {
	got := DistinctPermissions([]string{"b", "a", "b", "c", "a"})
	if !reflect.DeepEqual(got, []string{"b", "a", "c"}) {
		t.Errorf("got %v", got)
	}
}

func TestDistinctPermissions_NilStaysNilAndEmptyStaysEmpty(t *testing.T) {
	if got := DistinctPermissions(nil); got != nil {
		t.Errorf("nil gave %#v", got)
	}
	got := DistinctPermissions([]string{})
	if got == nil || len(got) != 0 {
		t.Errorf("empty gave %#v", got)
	}
}

func TestPermissionCatalog_ReturnsACopyAndNeverNilActions(t *testing.T) {
	first := PermissionCatalog()
	if len(first) == 0 {
		t.Fatal("catalog is empty")
	}
	for _, p := range first {
		if p.Actions == nil {
			t.Errorf("%s has nil actions", p.Code)
		}
	}
	first[0].Code = "tampered"
	if PermissionCatalog()[0].Code == "tampered" {
		t.Error("PermissionCatalog leaked its backing slice")
	}
}

func TestLookupPermission(t *testing.T) {
	if _, ok := LookupPermission("no.such.permission"); ok {
		t.Error("unknown code must not be found")
	}
	want := PermissionCatalog()[0]
	got, ok := LookupPermission(want.Code)
	if !ok || got.Code != want.Code {
		t.Errorf("got %v %v", got, ok)
	}
}

func TestMustLoadPermissions_RefusesBrokenCatalogs(t *testing.T) {
	for name, raw := range map[string]string{
		"not json":       `{`,
		"empty code":     `[{"code":""}]`,
		"duplicate code": `[{"code":"a"},{"code":"a"}]`,
	} {
		func() {
			defer func() {
				if recover() == nil {
					t.Errorf("%s: expected a panic", name)
				}
			}()
			mustLoadPermissions([]byte(raw))
		}()
	}
}

func TestMustLoadPermissions_FillsMissingActions(t *testing.T) {
	got := mustLoadPermissions([]byte(`[{"code":"a"}]`))
	if got[0].Actions == nil || len(got[0].Actions) != 0 {
		t.Errorf("got %#v", got[0].Actions)
	}
}

func TestDeclaredActionModules_FirstDeclaringModuleWinsAndModulelessAreSkipped(t *testing.T) {
	got := declaredActionModules([]Permission{
		{Code: "p1", Module: "forms", Actions: []string{"x.a", "x.b"}},
		{Code: "p2", Module: "voting", Actions: []string{"x.a", "y.c"}},
		{Code: "p3", Module: "", Actions: []string{"z.d"}},
	})
	want := map[string]string{"x.a": "forms", "x.b": "forms", "y.c": "voting"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v", got)
	}
}

func TestDeclaredModuleOfAction_UnknownActionHasNoModule(t *testing.T) {
	if got := DeclaredModuleOfAction("nothing.declared.here"); got != "" {
		t.Errorf("got %q", got)
	}
}
