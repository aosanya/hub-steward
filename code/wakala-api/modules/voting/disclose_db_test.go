package voting

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wakalaserver/modules/shared/spec"
)

func publishedPollFixture(t *testing.T) (PollManager, *gorm.DB, *spec.Spec, string) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL is not set")
	}
	u, err := url.Parse(dsn)
	if err != nil || (u.Hostname() != "127.0.0.1" && u.Hostname() != "localhost") {
		t.Skip("DATABASE_URL does not point at 127.0.0.1 or localhost")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	instance := fmt.Sprintf("mun11x%d", os.Getpid())
	s, err := SpecFor(instance)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		var names []string
		db.Raw("select tablename from pg_tables where schemaname = current_schema() and tablename like ?", instance+"%").Scan(&names)
		for _, name := range names {
			db.Exec(fmt.Sprintf("drop table if exists %q cascade", strings.ReplaceAll(name, `"`, "")))
		}
	})
	if err := Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	pm, err := NewPollManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	pm.UseGroups(func(context.Context, string) ([]string, error) { return []string{"ward-a"}, nil })
	pm.UseSettings(func(ctx context.Context) (map[string]any, map[string]spec.Override, error) {
		return spec.LoadSettingLayers(db, s)
	})
	ctx := context.Background()
	now := time.Now().UTC()
	p, err := pm.CreatePoll(ctx, Poll{
		Question: "Which street is resurfaced first?", Mode: "one", GroupIDs: []string{"ward-a"}, CreatedBy: "clerk",
		OpensAt: now.Add(-time.Hour).Format(time.RFC3339), ClosesAt: now.Add(time.Hour).Format(time.RFC3339),
		Choices: []Choice{{Label: "Mill Street"}, {Label: "Orchard Lane"}},
	})
	if err != nil {
		t.Fatalf("CreatePoll: %v", err)
	}
	return pm, db, s, p.ID
}

func answerAll(t *testing.T, pm PollManager, pollID string, picks ...int) {
	t.Helper()
	ctx := context.Background()
	choices, err := pm.ListChoices(ctx, pollID)
	if err != nil {
		t.Fatal(err)
	}
	for i, pick := range picks {
		_, err := pm.AnswerPoll(ctx, Answer{PollID: pollID, AnsweredBy: fmt.Sprintf("resident-%d", i), GroupID: "ward-a", Votes: map[string]int{choices[pick].ID: 1}})
		if err != nil {
			t.Fatalf("AnswerPoll %d: %v", i, err)
		}
	}
	if _, err := pm.PublishResult(ctx, Publication{PollID: pollID, PublishedBy: "clerk", GroupIDs: []string{"ward-a"}}); err != nil {
		t.Fatal(err)
	}
}

func TestPublishedCountOfAFewAnswersIsWithheldFromTheDatabase(t *testing.T) {
	pm, _, _, id := publishedPollFixture(t)
	answerAll(t, pm, id, 0, 0, 1)
	got, err := pm.ReadPublishedCount(context.Background(), id, "resident-0")
	if err != nil {
		t.Fatal(err)
	}
	if !got.AnsweredSuppressed || got.Answered != 0 || got.Minimum != DefaultMinimumCount {
		t.Fatalf("%+v", got)
	}
	for _, c := range got.Choices {
		if !c.Suppressed || c.Votes != 0 {
			t.Fatalf("%+v", c)
		}
	}
}

func TestDeclaredMinimumCountSettingChangesWhatIsPublished(t *testing.T) {
	pm, db, s, id := publishedPollFixture(t)
	answerAll(t, pm, id, 0, 0, 0, 1, 1, 1)
	ctx := context.Background()
	if _, err := spec.StoreOverride(db, s, "minimum_count", 4, "clerk", time.Now().UTC().Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}
	got, err := pm.ReadPublishedCount(ctx, id, "resident-0")
	if err != nil {
		t.Fatal(err)
	}
	if got.Minimum != 4 || !got.AnsweredSuppressed {
		t.Fatalf("%+v", got)
	}
	if _, err := spec.StoreOverride(db, s, "minimum_count", 3, "clerk", time.Now().UTC().Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}
	got, err = pm.ReadPublishedCount(ctx, id, "resident-0")
	if err != nil {
		t.Fatal(err)
	}
	if got.Minimum != 3 || got.AnsweredSuppressed || got.Answered != 6 || got.Choices[0].Votes != 3 {
		t.Fatalf("%+v", got)
	}
}

func TestFoldedChoiceIsNotNamedInThePublishedCountFromTheDatabase(t *testing.T) {
	pm, db, s, id := publishedPollFixture(t)
	answerAll(t, pm, id, 0, 0, 0, 0, 0, 0, 0, 1, 1)
	if _, err := spec.StoreOverride(db, s, "minimum_count", 3, "clerk", time.Now().UTC().Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}
	got, err := pm.ReadPublishedCount(context.Background(), id, "resident-0")
	if err != nil {
		t.Fatal(err)
	}
	if got.Other == nil || !got.Other.Suppressed || got.Other.Votes != 0 {
		t.Fatalf("%+v", got.Other)
	}
	raw, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "Orchard Lane") {
		t.Fatalf("folded choice named: %s", raw)
	}
	for _, c := range got.Choices {
		if c.Votes != 0 && c.Votes < 3 {
			t.Fatalf("%+v", c)
		}
	}
}
