package http

import (
	"context"
	"testing"
	"time"

	"wakalaserver/internal/agencies"
	"wakalaserver/modules/agency/models"
)

func cacheMountedSet(t *testing.T, instance string, set mountedSet) {
	t.Helper()
	agencyMountedSets.put(instance, set)
	t.Cleanup(func() { agencyMountedSets.forget(instance) })
}

func TestConsentIsRequiredOnlyWhereCustodyIsMountedAndTheAgencyIsGated(t *testing.T) {
	reg := func() agencies.Registry { return invitedNamesRegistry{} }
	cacheMountedSet(t, "consent-custody", mountedSet{modules: map[string]bool{"custody": true}})
	cacheMountedSet(t, "consent-no-custody", mountedSet{modules: map[string]bool{"forms": true}})
	cacheMountedSet(t, "consent-ungated", mountedSet{ungated: true, modules: map[string]bool{"custody": true}})

	required := ConsentRequired(reg)
	cases := map[string]bool{"consent-custody": true, "consent-no-custody": false, "consent-ungated": false}
	for instance, want := range cases {
		got, err := required(context.Background(), instance)
		if err != nil || got != want {
			t.Fatalf("%s: required=%v err=%v want %v", instance, got, err, want)
		}
	}
}

func TestConsentAndModuleChecksSayNoWhenThereIsNoRegistry(t *testing.T) {
	none := func() agencies.Registry { return nil }
	if got, err := ConsentRequired(none)(context.Background(), "x"); err != nil || got {
		t.Fatalf("consent without a registry: %v %v", got, err)
	}
	if got, err := ModuleMounted(none)(context.Background(), "x", "forms"); err != nil || got {
		t.Fatalf("module without a registry: %v %v", got, err)
	}
}

func TestModuleMountedFollowsTheMountedSet(t *testing.T) {
	reg := func() agencies.Registry { return invitedNamesRegistry{} }
	cacheMountedSet(t, "mounted-forms", mountedSet{modules: map[string]bool{"forms": true}})
	cacheMountedSet(t, "mounted-all", mountedSet{ungated: true})
	mounted := ModuleMounted(reg)
	cases := []struct {
		instance, module string
		want             bool
	}{
		{"mounted-forms", "forms", true},
		{"mounted-forms", "market", false},
		{"mounted-all", "market", true},
	}
	for _, c := range cases {
		got, err := mounted(context.Background(), c.instance, c.module)
		if err != nil || got != c.want {
			t.Fatalf("%s/%s: %v %v want %v", c.instance, c.module, got, err, c.want)
		}
	}
}

func TestMountedSetsExpireAndCanBeForgotten(t *testing.T) {
	clock := time.Date(2026, 11, 10, 9, 0, 0, 0, time.UTC)
	cache := &mountedSets{sets: map[string]mountedSet{}, now: func() time.Time { return clock }}
	cache.put("a", mountedSet{ungated: true})
	if _, ok := cache.get("a"); !ok {
		t.Fatal("a fresh set must be served")
	}
	clock = clock.Add(mountedModulesExpiry - time.Second)
	if _, ok := cache.get("a"); !ok {
		t.Fatal("a set just inside its expiry must still be served")
	}
	clock = clock.Add(2 * time.Second)
	if _, ok := cache.get("a"); ok {
		t.Fatal("a set past its expiry must be read again")
	}
	cache.put("b", mountedSet{})
	cache.forget("b")
	if _, ok := cache.get("b"); ok {
		t.Fatal("a forgotten set must be read again")
	}
}

func TestMountedModulesKeepOnlyEnabledOnesAndTheirRequirements(t *testing.T) {
	doc := models.AgencyDocument{Modules: []models.DocumentModule{
		{Code: "forms", Enabled: true},
		{Code: "market", Enabled: false},
	}}
	enabled := mountedModules(doc)
	if !enabled["forms"] || enabled["market"] {
		t.Fatalf("enabled set %v", enabled)
	}
	mounts := mountedMounts(doc)
	if _, ok := mounts["forms"]; !ok {
		t.Fatalf("an enabled module must have its mounts, got %v", mounts)
	}
	if _, ok := mounts["market"]; ok {
		t.Fatalf("a disabled module must have none, got %v", mounts)
	}
}

func TestMountsOfAnUnmountedModuleAreNone(t *testing.T) {
	set := mountedSet{modules: map[string]bool{"forms": true}}
	if got := set.mountsOf("market"); got != nil {
		t.Fatalf("an unmounted module has no mounts, got %v", got)
	}
	if got := set.mountsOf("not-a-module"); got != nil {
		t.Fatalf("an unknown module has no mounts, got %v", got)
	}
	held := []models.ModuleMount{{Key: "main"}}
	set = mountedSet{modules: map[string]bool{"forms": true}, mounts: map[string][]models.ModuleMount{"forms": held}}
	if got := set.mountsOf("forms"); len(got) != 1 || got[0].Key != "main" {
		t.Fatalf("held mounts must be returned as they are, got %v", got)
	}
}
