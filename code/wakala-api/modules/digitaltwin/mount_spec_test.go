package digitaltwin

import "testing"

func TestTheWakalaSpecDeclaresOneObjectPerRole(t *testing.T) {
	s, err := SpecFor("app")
	if err != nil {
		t.Fatalf("spec for app: %v", err)
	}
	b, err := Blueprint()
	if err != nil {
		t.Fatalf("blueprint: %v", err)
	}
	if len(s.Objects) != len(b.Objects) {
		t.Errorf("spec declares %d objects, blueprint has %d roles", len(s.Objects), len(b.Objects))
	}
}

func TestAMountedSpecKeepsItsMount(t *testing.T) {
	s, err := SpecForMount("app", "places")
	if err != nil {
		t.Fatalf("spec for mount: %v", err)
	}
	if s.Mount != "places" {
		t.Errorf("mount = %q", s.Mount)
	}
}
