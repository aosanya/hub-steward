package models

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestModuleCatalog_MountableModulesAcceptAMount(t *testing.T) {
	cases := []struct {
		code  string
		mount string
		icon  string
	}{
		{"assetmanager", "assets", "wrench"},
		{"council", "council", "file"},
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

func TestValidateModuleMounts_Words(t *testing.T) {
	tooMany := map[string]string{}
	for i := 0; i <= MaxMountWords; i++ {
		tooMany[strings.Repeat("a", i+1)] = "x"
	}
	cases := []struct {
		name  string
		words map[string]string
		ok    bool
	}{
		{"none", nil, true},
		{"one pair", map[string]string{"People": "Residents"}, true},
		{"empty generic", map[string]string{"": "Residents"}, false},
		{"empty replacement", map[string]string{"People": ""}, false},
		{"untrimmed replacement", map[string]string{"People": " Residents"}, false},
		{"untrimmed generic", map[string]string{"People ": "Residents"}, false},
		{"newline in replacement", map[string]string{"People": "Resi\ndents"}, false},
		{"tab in generic", map[string]string{"Peo\tple": "Residents"}, false},
		{"replacement at the limit", map[string]string{"People": strings.Repeat("r", MaxMountWordLength)}, true},
		{"replacement over the limit", map[string]string{"People": strings.Repeat("r", MaxMountWordLength+1)}, false},
		{"generic over the limit", map[string]string{strings.Repeat("g", MaxMountWordLength+1): "Residents"}, false},
		{"multibyte words at the limit", map[string]string{strings.Repeat("é", MaxMountWordLength): strings.Repeat("ü", MaxMountWordLength)}, true},
		{"too many words", tooMany, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := ValidateModuleMounts("actor", []ModuleMount{{Name: "Residents", Key: "directory", Words: c.words}})
			if c.ok && err != nil {
				t.Errorf("refused: %v", err)
			}
			if !c.ok && !errors.Is(err, ErrInvalidMounts) {
				t.Errorf("err = %v, want ErrInvalidMounts", err)
			}
		})
	}
}

func TestModuleMounts_WordsRoundTripThroughStoredJSON(t *testing.T) {
	stored := `[{"name":"Residents","key":"directory","words":{"People":"Residents"}},{"name":"Plain","key":"plain"}]`
	mounts := EffectiveModuleMounts("council", stored)
	if len(mounts) != 2 || mounts[0].Words["People"] != "Residents" || mounts[1].Words != nil {
		t.Fatalf("mounts = %+v", mounts)
	}
	raw, err := json.Marshal(mounts[1])
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "words") {
		t.Errorf("a mount without words marshals a words key: %s", raw)
	}
}
