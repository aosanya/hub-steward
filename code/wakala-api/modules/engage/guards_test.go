package engage_test

import (
	"path/filepath"
	"testing"

	engage "wakalaserver/modules/engage"
	"wakalaserver/modules/engage/models"
)

func shippedSpecs(t *testing.T) []string {
	t.Helper()
	paths, err := filepath.Glob("spec/examples/*.engage.json")
	if err != nil || len(paths) < 2 {
		t.Fatalf("want at least two shipped examples, got %v (%v)", paths, err)
	}
	return append([]string{"engage.wakala.json"}, paths...)
}

func TestEveryExampleFitsTheTypes(t *testing.T) {
	for _, p := range shippedSpecs(t) {
		s, err := engage.LoadSpec(p)
		if err != nil {
			t.Fatalf("%s: %v", p, err)
		}
		db := openDB(t)
		if err := engage.Provision(db, s); err != nil {
			t.Fatalf("%s: Provision: %v", p, err)
		}
		if _, err := engage.NewPostManager(db, s); err != nil {
			t.Fatalf("%s: %v", p, err)
		}
	}
}

func TestShippedExamplesCoexist(t *testing.T) {
	db := openDB(t)
	for _, p := range shippedSpecs(t) {
		s, err := engage.LoadSpec(p)
		if err != nil {
			t.Fatalf("%s: %v", p, err)
		}
		if err := engage.Provision(db, s); err != nil {
			t.Fatalf("%s: Provision into a shared database: %v", p, err)
		}
	}
}

func TestVocabularyMatchesTheBlueprint(t *testing.T) {
	want := map[string][]string{
		"post.kind":   {models.KindNotice, models.KindEvent, models.KindVolunteerCall},
		"post.state":  {models.StateSent, models.StateCancelled, models.StateFilled},
		"rsvp.answer": {models.AnswerGoing, models.AnswerNotGoing},
	}
	b, err := engage.Blueprint()
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, o := range b.Objects {
		for _, f := range o.Fields {
			if len(f.Values) == 0 {
				continue
			}
			key := o.Role + "." + f.Name
			seen[key] = true
			consts, ok := want[key]
			if !ok {
				t.Errorf("%s declares values with no Go constants beside them", key)
				continue
			}
			if len(consts) != len(f.Values) {
				t.Errorf("%s: blueprint %v, constants %v", key, f.Values, consts)
				continue
			}
			for i := range consts {
				if consts[i] != f.Values[i] {
					t.Errorf("%s: blueprint %v, constants %v", key, f.Values, consts)
				}
			}
		}
	}
	for key := range want {
		if !seen[key] {
			t.Errorf("constants for %s match no declared enum", key)
		}
	}
}

func TestRequiredFieldsHaveNoDefault(t *testing.T) {
	for _, p := range shippedSpecs(t) {
		s, err := engage.LoadSpec(p)
		if err != nil {
			t.Fatalf("%s: %v", p, err)
		}
		for _, o := range s.Objects {
			for _, f := range o.Fields {
				if f.Required && f.Default != "" {
					t.Errorf("%s: %s.%s is required and defaulted", p, o.Role, f.Name)
				}
			}
		}
	}
}
