package mwanachamacatalog_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	catalog "wakalaserver/modules/catalog"
)

func TestCataloguesAreReadWithEachProblemNamedByItsPlace(t *testing.T) {
	good, problems := catalog.ParseCatalogues([]any{
		map[string]any{"mount": "market", "name": "Market", "audience": "public"},
		map[string]any{"mount": "library", "name": "Library", "audience": "staff", "services": true},
	})
	if len(problems) != 0 || len(good) != 2 || good[1].Mount != "library" || !good[1].Services {
		t.Fatalf("%+v %v", good, problems)
	}
	if none, problems := catalog.ParseCatalogues(nil); none != nil || problems != nil {
		t.Fatalf("a missing setting is not a problem: %+v %v", none, problems)
	}
	bad, problems := catalog.ParseCatalogues([]any{
		map[string]any{"mount": "Market", "name": "Market", "audience": "public"},
		map[string]any{"mount": "market", "name": " ", "audience": "everyone"},
		map[string]any{"mount": "market", "name": "Again", "audience": "members"},
	})
	if bad != nil || len(problems) != 4 {
		t.Fatalf("%+v %v", bad, problems)
	}
	joined := strings.Join(problems, "\n")
	for _, want := range []string{"catalogues[0]: mount", "catalogues[1]: a name is required", `audience "everyone"`, "catalogues[2]: mount \"market\" is listed twice"} {
		if !strings.Contains(joined, want) {
			t.Fatalf("missing %q in:\n%s", want, joined)
		}
	}
	if _, problems := catalog.ParseCatalogues("not a list"); len(problems) != 1 {
		t.Fatalf("%v", problems)
	}
	if _, problems := catalog.ParseCatalogues([]any{map[string]any{"mount": "market", "name": "M", "audience": "public", "colour": "red"}}); len(problems) != 1 {
		t.Fatalf("an unknown field passed: %v", problems)
	}
}

func TestSettingsAreCheckedAsAWholeBeforeTheyAreSaved(t *testing.T) {
	for _, c := range []struct {
		name string
		raw  string
		want string
	}{
		{"nothing", ``, ""},
		{"null", `null`, ""},
		{"not an object", `[1]`, "not a JSON object"},
		{"a bad routing", `{"routing":{"default":"Front","rules":[{"topic":"Roads","department":"A"},{"topic":"Roads","department":"B"}]}}`, "routing"},
		{"a bad catalogue", `{"catalogues":[{"mount":"Bad","name":"x","audience":"public"}]}`, "catalogues[0]"},
		{"a good routing and catalogue", `{"routing":{"default":"Front","rules":[{"topic":"Roads","department":"Works"}]},"catalogues":[{"mount":"market","name":"Market","audience":"public"}]}`, ""},
	} {
		t.Run(c.name, func(t *testing.T) {
			problems := catalog.CheckSettings(json.RawMessage(c.raw))
			joined := strings.Join(problems, "\n")
			if c.want == "" && len(problems) != 0 {
				t.Fatalf("a good setting was refused: %v", problems)
			}
			if c.want != "" && !strings.Contains(joined, c.want) {
				t.Fatalf("want a problem naming %q, got %v", c.want, problems)
			}
		})
	}
}

func TestRecordsAreTalliedByFieldAndMalformedOnesAreRefused(t *testing.T) {
	tallies, err := catalog.TallyRecords([]catalog.Record{
		{HolderID: "a", Doc: `{"bags":4,"crop":"maize"}`},
		{HolderID: "b", Doc: `{"bags":6,"crop":"maize"}`},
		{HolderID: "a", Doc: `{"bags":2}`},
	})
	if err != nil || len(tallies) != 2 || tallies[0].Field != "bags" || tallies[1].Field != "crop" {
		t.Fatalf("%+v %v", tallies, err)
	}
	if tallies[0].Counted != 3 || tallies[0].Holders != 2 || tallies[0].Average == nil || *tallies[0].Average != 4 {
		t.Fatalf("%+v", tallies[0])
	}
	if _, err := catalog.TallyRecords([]catalog.Record{{Doc: `{`}}); err == nil {
		t.Fatal("a malformed record was tallied")
	}
	if got, err := catalog.TallyRecords(nil); err != nil || len(got) != 0 {
		t.Fatalf("%+v %v", got, err)
	}
}

func TestAnonymousCallersAreMarkedOnTheContext(t *testing.T) {
	ctx := context.Background()
	if catalog.AsAnonymous(ctx) == ctx {
		t.Fatal("AsAnonymous returned the same context")
	}
	cm := entryManager(t)
	if _, err := cm.CreateEntry(ctx, entry("clinic")); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.SetVisibility(ctx, "clinic", catalog.VisibilityPublic); err != nil {
		t.Fatal(err)
	}
	if got, err := cm.OpenEntry(catalog.AsAnonymous(ctx), "clinic", ""); err != nil || got.SubmittedBy != "" {
		t.Fatalf("%+v %v", got, err)
	}
}
