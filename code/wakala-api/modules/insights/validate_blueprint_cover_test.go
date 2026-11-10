package mwanachamainsights

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"wakalaserver/modules/insights/models"
)

func TestCheckAcceptsAGoodInsightByValueAndByPointer(t *testing.T) {
	s, err := SpecFor("check")
	if err != nil {
		t.Fatal(err)
	}
	good := models.Insight{Summary: "s", Source: "user"}
	if err := Check(s, RoleInsight, good); err != nil {
		t.Fatal(err)
	}
	if err := Check(s, RoleInsight, &good); err != nil {
		t.Fatal(err)
	}
}

func TestCheckNamesWhatIsWrong(t *testing.T) {
	s, err := SpecFor("check")
	if err != nil {
		t.Fatal(err)
	}
	cases := map[string]struct {
		role string
		v    any
		want string
	}{
		"unknown role":   {"ghost", models.Insight{}, `no object for the role "ghost"`},
		"not a struct":   {RoleInsight, "text", "want a struct"},
		"missing field":  {RoleInsight, models.Insight{Source: "auto"}, "summary is required"},
		"blank field":    {RoleNote, models.InsightNote{Source: "auto", InsightID: " ", Text: "t"}, "insight_id is required"},
		"outside values": {RoleInsight, models.Insight{Summary: "s", Source: "robot"}, `source is "robot", which is not one of auto, user`},
	}
	for name, c := range cases {
		err := Check(s, c.role, c.v)
		if err == nil || !strings.Contains(err.Error(), c.want) {
			t.Fatalf("%s: err = %v, want it to say %q", name, err, c.want)
		}
	}
}

func TestSpecForMountCarriesInstanceAndMount(t *testing.T) {
	plain, err := SpecFor("one")
	if err != nil {
		t.Fatal(err)
	}
	mounted, err := SpecForMount("one", "notes")
	if err != nil {
		t.Fatal(err)
	}
	if plain.Instance != "one" || mounted.Instance != "one" {
		t.Fatalf("%q %q", plain.Instance, mounted.Instance)
	}
	pi, _ := plain.ByRole(RoleInsight)
	mi, _ := mounted.ByRole(RoleInsight)
	if plain.MountName() != "main" || mounted.MountName() != "notes" {
		t.Fatalf("%q %q", plain.MountName(), mounted.MountName())
	}
	if plain.TableFor(pi) == mounted.TableFor(mi) {
		t.Fatalf("a mount must not share its table with the plain instance: %q", plain.TableFor(pi))
	}
}

func TestParseSpecRefusesGarbageAndLoadSpecRefusesAMissingFile(t *testing.T) {
	if _, err := ParseSpec([]byte("not json")); err == nil {
		t.Fatal("garbage parsed")
	}
	if _, err := LoadSpec(filepath.Join(t.TempDir(), "missing.json")); err == nil {
		t.Fatal("a missing file loaded")
	}
}

func TestLoadSpecReadsADomainFileFromDisk(t *testing.T) {
	path := filepath.Join(t.TempDir(), "insights.json")
	raw := `{"module":"insights","domain":"wakala","instance":"fromdisk","objects":[{"role":"insight","name":"insight","table":"insights","description":"d"},{"role":"note","name":"insight_note","table":"insight_notes","description":"d"}]}`
	if err := os.WriteFile(path, []byte(raw), 0o600); err != nil {
		t.Fatal(err)
	}
	s, err := LoadSpec(path)
	if err != nil {
		t.Fatal(err)
	}
	if s.Instance != "fromdisk" {
		t.Fatalf("instance = %q", s.Instance)
	}
}

func TestBlueprintDeclaresBothRolesAndOperationsAreJSON(t *testing.T) {
	b, err := Blueprint()
	if err != nil {
		t.Fatal(err)
	}
	roles := b.Roles()
	if len(roles) != 2 {
		t.Fatalf("roles = %v", roles)
	}
	if !json.Valid(Operations()) {
		t.Fatal("operations are not JSON")
	}
}

func TestPatternsAreEmptyBecauseNothingHereIsPatterned(t *testing.T) {
	if len(patterns) != 0 {
		t.Fatalf("patterns = %d", len(patterns))
	}
}
