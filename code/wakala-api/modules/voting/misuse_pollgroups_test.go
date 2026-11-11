package voting

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wakalaserver/modules/shared/spec"
)

func pollInMemory(t *testing.T) (PollManager, string) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	s, err := SpecFor("test")
	if err != nil {
		t.Fatal(err)
	}
	if err := Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	pm, err := NewPollManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	pm.UseSettings(func(ctx context.Context) (map[string]any, map[string]spec.Override, error) {
		return spec.LoadSettingLayers(db, s)
	})
	now := time.Now().UTC()
	p, err := pm.CreatePoll(context.Background(), Poll{
		Question: "Which street is resurfaced first?", Mode: "one", GroupIDs: []string{"ward-a"}, CreatedBy: "clerk",
		OpensAt: now.Add(-time.Hour).Format(time.RFC3339), ClosesAt: now.Add(time.Hour).Format(time.RFC3339),
		Choices: []Choice{{Label: "Mill Street"}, {Label: "Orchard Lane"}},
	})
	if err != nil {
		t.Fatalf("CreatePoll: %v", err)
	}
	return pm, p.ID
}

func TestPublishResult_OperatorCannotPublishToAGroupOutsideThePoll(t *testing.T) {
	pm, id := pollInMemory(t)
	ctx := context.Background()
	if _, err := pm.PublishResult(ctx, Publication{PollID: id, PublishedBy: "clerk", GroupIDs: []string{"ward-b"}}); err == nil {
		t.Error("result published to a group the poll does not go to")
	}
	if _, err := pm.PublishResult(ctx, Publication{PollID: id, PublishedBy: "clerk", GroupIDs: []string{"no-such-group"}}); err == nil {
		t.Error("result published to a nonexistent group")
	}
	if _, err := pm.PublishResult(ctx, Publication{PollID: id, PublishedBy: "clerk", GroupIDs: []string{"ward-a"}}); err != nil {
		t.Fatalf("result to the poll's own group refused: %v", err)
	}
}

func TestPublishResult_OperatorCannotRepublishToOverwriteAPublishedResult(t *testing.T) {
	pm, id := pollInMemory(t)
	ctx := context.Background()
	first, err := pm.PublishResult(ctx, Publication{PollID: id, PublishedBy: "clerk", GroupIDs: []string{"ward-a"}})
	if err != nil {
		t.Fatalf("first publication refused: %v", err)
	}
	if _, err := pm.PublishResult(ctx, Publication{PollID: id, PublishedBy: "other-clerk", GroupIDs: []string{"ward-a"}}); err == nil {
		got, _ := pm.GetPoll(ctx, id)
		t.Fatalf("second publication admitted: published_at %q -> %q, published_by %q -> %q", first.PublishedAt, got.PublishedAt, first.PublishedBy, got.PublishedBy)
	}
}

func TestCreatePoll_OperatorCannotAimAPollAtAGroupOutsideTheAgency(t *testing.T) {
	pm, _ := pollInMemory(t)
	pm.UseGroupExists(func(_ context.Context, groupID string) (bool, error) { return groupID == "ward-a", nil })
	ctx := context.Background()
	now := time.Now().UTC()
	aimed := func(groups ...string) error {
		_, err := pm.CreatePoll(ctx, Poll{
			Question: "Which bench colour?", Mode: "one", GroupIDs: groups, CreatedBy: "clerk",
			OpensAt: now.Add(-time.Hour).Format(time.RFC3339), ClosesAt: now.Add(time.Hour).Format(time.RFC3339),
			Choices: []Choice{{Label: "green"}, {Label: "blue"}},
		})
		return err
	}
	for _, groups := range [][]string{{"farmers-ward"}, {"ward-a", "farmers-ward"}, {""}, {"ward-a", ""}} {
		if err := aimed(groups...); !errors.Is(err, ErrInvalidPoll) {
			t.Errorf("poll aimed at %q admitted: %v", groups, err)
		}
	}
	if err := aimed("ward-a"); err != nil {
		t.Fatalf("poll aimed at the agency's own group refused: %v", err)
	}
}

func TestCreatePoll_OperatorCannotAimAPollAtAnEmptyGroupId(t *testing.T) {
	pm, _ := pollInMemory(t)
	now := time.Now().UTC()
	_, err := pm.CreatePoll(context.Background(), Poll{
		Question: "Which bench colour?", Mode: "one", GroupIDs: []string{""}, CreatedBy: "clerk",
		OpensAt: now.Add(-time.Hour).Format(time.RFC3339), ClosesAt: now.Add(time.Hour).Format(time.RFC3339),
		Choices: []Choice{{Label: "green"}, {Label: "blue"}},
	})
	if !errors.Is(err, ErrInvalidPoll) {
		t.Fatalf("poll aimed at an empty group id admitted: %v", err)
	}
}
