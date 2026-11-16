package models

import "testing"

func TestModuleCatalog_MountableModulesAcceptAMount(t *testing.T) {
	cases := []struct {
		code  string
		mount string
		icon  string
	}{
		{"assetmanager", "assets", "wrench"},
		{"digitaltwin", "places", "globe"},
		{"riskmanager", "risks", "alert"},
	}
	for _, c := range cases {
		t.Run(c.code, func(t *testing.T) {
			entry, ok := CatalogEntry(c.code)
			if !ok {
				t.Fatalf("the catalog has no %s", c.code)
			}
			if entry.Mount != c.mount {
				t.Errorf("%s mount = %q, want %q", c.code, entry.Mount, c.mount)
			}
			if entry.Icon != c.icon {
				t.Errorf("%s icon = %q, want %q", c.code, entry.Icon, c.icon)
			}
			if !entry.Mountable {
				t.Errorf("%s is not mountable", c.code)
			}
			if entry.Enabled || entry.Locked {
				t.Errorf("%s must start off and unlocked, got enabled=%v locked=%v", c.code, entry.Enabled, entry.Locked)
			}
			if entry.Description == "" {
				t.Errorf("%s has no description", c.code)
			}
			named := []ModuleMount{{Name: "First", Key: c.mount}, {Name: "Second", Key: "second"}}
			if err := ValidateModuleMounts(c.code, named); err != nil {
				t.Errorf("%s refuses two mounts: %v", c.code, err)
			}
			if got := EffectiveModuleMounts(c.code, ""); len(got) != 1 || got[0].Key != c.mount {
				t.Errorf("%s default mounts = %v, want one with key %q", c.code, got, c.mount)
			}
		})
	}
}

func TestModuleCatalog_AssetmanagerFollowsRiskmanager(t *testing.T) {
	last := len(ModuleCatalog) - 1
	if last < 1 || ModuleCatalog[last].Code != "assetmanager" || ModuleCatalog[last-1].Code != "riskmanager" {
		t.Fatalf("assetmanager must come right after riskmanager at the end of the catalog")
	}
}
