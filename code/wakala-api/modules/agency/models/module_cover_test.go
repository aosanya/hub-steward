package models

import (
	"errors"
	"reflect"
	"sort"
	"strings"
	"testing"
)

func TestWithRequiredModules_PullsInTheTransitiveRequirementsOfEnabledModules(t *testing.T) {
	got := WithRequiredModules(map[string]bool{"forms": true})
	for _, code := range []string{"forms", "catalog", "git"} {
		if !got[code] {
			t.Errorf("enabling forms must also enable %s, got %v", code, got)
		}
	}
}

func TestWithRequiredModules_IgnoresModulesSwitchedOff(t *testing.T) {
	got := WithRequiredModules(map[string]bool{"forms": false, "comm": true})
	if got["forms"] || got["catalog"] || got["git"] {
		t.Errorf("a module switched off must pull nothing in, got %v", got)
	}
	if !got["comm"] {
		t.Errorf("comm was on and must stay on, got %v", got)
	}
}

func TestWithRequiredModules_EmptyInputGivesAnEmptyNonNilMap(t *testing.T) {
	got := WithRequiredModules(nil)
	if got == nil || len(got) != 0 {
		t.Errorf("want an empty non-nil map, got %#v", got)
	}
}

func TestWithRequiredModules_DoesNotChangeItsInput(t *testing.T) {
	in := map[string]bool{"forms": true}
	WithRequiredModules(in)
	if len(in) != 1 || !in["forms"] {
		t.Errorf("input was modified: %v", in)
	}
}

func TestModuleRequires_UnknownCodeRequiresNothing(t *testing.T) {
	if got := ModuleRequires("no-such-module"); got != nil {
		t.Errorf("got %v, want nil", got)
	}
}

func TestModuleRequires_ReturnsTheCatalogRequirements(t *testing.T) {
	got := append([]string(nil), ModuleRequires("forms")...)
	sort.Strings(got)
	if !reflect.DeepEqual(got, []string{"catalog", "git"}) {
		t.Errorf("forms requires %v", got)
	}
}

func TestModulesNeededBySteps_MapsStepKindsToTheModulesThatRunThem(t *testing.T) {
	needed := ModulesNeededBySteps(map[StepKind]bool{StepKindChat: true, StepKindSendForm: true})
	if !needed["comm"] || !needed["forms"] {
		t.Errorf("chat needs comm and send_form needs forms, got %v", needed)
	}
}

func TestModulesNeededBySteps_AKindSetToFalseNeedsNothing(t *testing.T) {
	needed := ModulesNeededBySteps(map[StepKind]bool{StepKindChat: false})
	if len(needed) != 0 {
		t.Errorf("got %v, want none", needed)
	}
}

func TestModulesNeededBySteps_KindsNoModuleRunsNeedNothing(t *testing.T) {
	needed := ModulesNeededBySteps(map[StepKind]bool{StepKindRoute: true, StepKindRunWorkflow: true})
	if len(needed) != 0 {
		t.Errorf("got %v, want none", needed)
	}
}

func TestParseModuleMounts_BlankIsNoMounts(t *testing.T) {
	for _, raw := range []string{"", "   ", "\n\t"} {
		mounts, err := ParseModuleMounts(raw)
		if err != nil || mounts != nil {
			t.Errorf("%q: got %v, %v", raw, mounts, err)
		}
	}
}

func TestParseModuleMounts_ReadsAJSONList(t *testing.T) {
	mounts, err := ParseModuleMounts(`[{"name":"Fleet","key":"fleet","icon":"bike"}]`)
	if err != nil {
		t.Fatal(err)
	}
	want := []ModuleMount{{Name: "Fleet", Key: "fleet", Icon: "bike"}}
	if !reflect.DeepEqual(mounts, want) {
		t.Errorf("got %v", mounts)
	}
}

func TestParseModuleMounts_BadJSONIsErrInvalidMounts(t *testing.T) {
	for _, raw := range []string{"{", `{"name":"x"}`, "not json"} {
		if _, err := ParseModuleMounts(raw); !errors.Is(err, ErrInvalidMounts) {
			t.Errorf("%q: err = %v", raw, err)
		}
	}
}

func TestEffectiveModuleMounts_StoredMountsWin(t *testing.T) {
	got := EffectiveModuleMounts("assetmanager", `[{"name":"Tools","key":"tools"}]`)
	if len(got) != 1 || got[0].Key != "tools" {
		t.Errorf("got %v", got)
	}
}

func TestEffectiveModuleMounts_FallsBackToTheCatalogDefault(t *testing.T) {
	for _, stored := range []string{"", "[]", "garbage"} {
		got := EffectiveModuleMounts("assetmanager", stored)
		if len(got) != 1 || got[0].Key != "assets" {
			t.Errorf("stored %q: got %v", stored, got)
		}
	}
}

func TestEffectiveModuleMounts_UnknownModuleHasNone(t *testing.T) {
	if got := EffectiveModuleMounts("no-such-module", ""); got != nil {
		t.Errorf("got %v", got)
	}
}

func TestDefaultModuleMounts_AnEntryWithNoMountHasNone(t *testing.T) {
	if got := DefaultModuleMounts(ModuleCatalogEntry{Name: "x"}); got != nil {
		t.Errorf("got %v", got)
	}
	got := DefaultModuleMounts(ModuleCatalogEntry{Name: "Risks", Mount: "risks"})
	if !reflect.DeepEqual(got, []ModuleMount{{Name: "Risks", Key: "risks"}}) {
		t.Errorf("got %v", got)
	}
}

func TestMaxMountsFor(t *testing.T) {
	cases := []struct {
		name  string
		entry ModuleCatalogEntry
		want  int
	}{
		{"mountable", ModuleCatalogEntry{Mountable: true, Mount: "x"}, MaxModuleMounts},
		{"mountable without a default", ModuleCatalogEntry{Mountable: true}, MaxModuleMounts},
		{"fixed single mount", ModuleCatalogEntry{Mount: "main"}, 1},
		{"no mount at all", ModuleCatalogEntry{}, 0},
	}
	for _, c := range cases {
		if got := MaxMountsFor(c.entry); got != c.want {
			t.Errorf("%s: got %d, want %d", c.name, got, c.want)
		}
	}
}

func TestValidateModuleMounts(t *testing.T) {
	tooMany := make([]ModuleMount, MaxModuleMounts+1)
	for i := range tooMany {
		tooMany[i] = ModuleMount{Name: "m" + strings.Repeat("x", i), Key: "k" + strings.Repeat("x", i)}
	}
	cases := []struct {
		name   string
		code   string
		mounts []ModuleMount
		ok     bool
	}{
		{"none is fine for any code", "no-such-module", nil, true},
		{"one good mount", "assetmanager", []ModuleMount{{Name: "Tools", Key: "tools", Icon: "wrench"}}, true},
		{"unknown module", "no-such-module", []ModuleMount{{Name: "A", Key: "a"}}, false},
		{"module that cannot mount", "auth", []ModuleMount{{Name: "A", Key: "a"}, {Name: "B", Key: "b"}}, false},
		{"over the cap", "assetmanager", tooMany, false},
		{"blank name", "assetmanager", []ModuleMount{{Name: "", Key: "a"}}, false},
		{"padded name", "assetmanager", []ModuleMount{{Name: " A", Key: "a"}}, false},
		{"name too long", "assetmanager", []ModuleMount{{Name: strings.Repeat("a", MaxMountNameLength+1), Key: "a"}}, false},
		{"name at the limit", "assetmanager", []ModuleMount{{Name: strings.Repeat("é", MaxMountNameLength), Key: "a"}}, true},
		{"control character in name", "assetmanager", []ModuleMount{{Name: "A\x07B", Key: "a"}}, false},
		{"names differ only by case", "assetmanager", []ModuleMount{{Name: "Fleet", Key: "a"}, {Name: "fleet", Key: "b"}}, false},
		{"empty key", "assetmanager", []ModuleMount{{Name: "A", Key: ""}}, false},
		{"duplicate key", "assetmanager", []ModuleMount{{Name: "A", Key: "k"}, {Name: "B", Key: "k"}}, false},
		{"icon outside the set", "assetmanager", []ModuleMount{{Name: "A", Key: "a", Icon: "rocket"}}, false},
		{"two distinct mounts", "assetmanager", []ModuleMount{{Name: "A", Key: "a"}, {Name: "B", Key: "b"}}, true},
	}
	for _, c := range cases {
		err := ValidateModuleMounts(c.code, c.mounts)
		if c.ok && err != nil {
			t.Errorf("%s: unexpected %v", c.name, err)
		}
		if !c.ok && !errors.Is(err, ErrInvalidMounts) {
			t.Errorf("%s: err = %v, want ErrInvalidMounts", c.name, err)
		}
	}
}

func TestMountKeyFromName(t *testing.T) {
	cases := map[string]string{
		"Fleet Cars":   "fleetcars",
		"  Lab 2  ":    "lab2",
		"2nd floor":    "ndfloor",
		"Cañon":        "caon",
		"!!!":          "mount",
		"":             "mount",
		"123":          "mount",
		"a-b_c.d":      "abcd",
		"Warehouse 12": "warehouse12",
	}
	for in, want := range cases {
		if got := MountKeyFromName(in); got != want {
			t.Errorf("MountKeyFromName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestMustParseModuleCatalog_RefusesBrokenCatalogs(t *testing.T) {
	cases := map[string]string{
		"not json":          `{`,
		"empty code":        `[{"code":""}]`,
		"duplicate code":    `[{"code":"a"},{"code":"a"}]`,
		"unknown icon":      `[{"code":"a","icon":"rocket"}]`,
		"unknown step kind": `[{"code":"a","step_kinds":["teleport"]}]`,
		"unknown requires":  `[{"code":"a","requires":["b"]}]`,
	}
	for name, raw := range cases {
		func() {
			defer func() {
				if recover() == nil {
					t.Errorf("%s: expected a panic", name)
				}
			}()
			mustParseModuleCatalog([]byte(raw))
		}()
	}
}

func TestMustParseModuleCatalog_AcceptsARequirementListedLater(t *testing.T) {
	got := mustParseModuleCatalog([]byte(`[{"code":"a","requires":["b"]},{"code":"b","step_kinds":["chat"]}]`))
	if len(got) != 2 {
		t.Errorf("got %v", got)
	}
}

func TestCatalogEntry(t *testing.T) {
	if _, ok := CatalogEntry("nope"); ok {
		t.Error("unknown code must not be found")
	}
	entry, ok := CatalogEntry("comm")
	if !ok || entry.Code != "comm" {
		t.Errorf("got %v %v", entry, ok)
	}
}
