package engage_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	engage "wakalaserver/modules/engage"
)

func openDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	return db
}

func newTestManager(t *testing.T) engage.PostManager {
	t.Helper()
	db := openDB(t)
	s, err := engage.SpecFor("test")
	if err != nil {
		t.Fatalf("SpecFor: %v", err)
	}
	if err := engage.Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	pm, err := engage.NewPostManager(db, s)
	if err != nil {
		t.Fatalf("NewPostManager: %v", err)
	}
	return pm
}

func anEvent() engage.Post {
	start := time.Now().UTC().Add(30 * 24 * time.Hour).Truncate(time.Hour)
	return engage.Post{
		Kind:     "event",
		Title:    "Clean-up day",
		GroupIDs: []string{"g-1"},
		StartsAt: start.Format(time.RFC3339),
		EndsAt:   start.Add(4 * time.Hour).Format(time.RFC3339),
		TimeZone: "Africa/Nairobi",
		Place:    "The market",
		PostedBy: "actor-1",
	}
}

func TestASentPostReadsBackAsSent(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	p, err := pm.CreatePost(ctx, anEvent())
	if err != nil {
		t.Fatalf("CreatePost: %v", err)
	}
	got, err := pm.GetPost(ctx, p.ID)
	if err != nil || got.State != "sent" || got.Place != "The market" || len(got.GroupIDs) != 1 || got.PostedAt == "" {
		t.Fatalf("GetPost = %+v, %v", got, err)
	}
}

func TestAPostWithNoCallerIsRefused(t *testing.T) {
	in := anEvent()
	in.PostedBy = ""
	if _, err := newTestManager(t).CreatePost(context.Background(), in); !errors.Is(err, engage.ErrNoPoster) {
		t.Fatalf("err = %v, want ErrNoPoster", err)
	}
}

func TestAPostThatCannotHoldIsRefused(t *testing.T) {
	pm := newTestManager(t)
	cases := map[string]func(*engage.Post){
		"no group":            func(p *engage.Post) { p.GroupIDs = nil },
		"undeclared kind":     func(p *engage.Post) { p.Kind = "survey" },
		"no title":            func(p *engage.Post) { p.Title = "" },
		"backwards event":     func(p *engage.Post) { p.EndsAt = p.StartsAt },
		"call needing no one": func(p *engage.Post) { p.Kind = "volunteer_call" },
	}
	for name, spoil := range cases {
		in := anEvent()
		spoil(&in)
		if _, err := pm.CreatePost(context.Background(), in); !errors.Is(err, engage.ErrInvalidPost) {
			t.Errorf("%s: err = %v, want ErrInvalidPost", name, err)
		}
	}
}

func TestAnUnknownPostIsNotFound(t *testing.T) {
	if _, err := newTestManager(t).GetPost(context.Background(), "nope"); !errors.Is(err, engage.ErrPostNotFound) {
		t.Fatalf("err = %v, want ErrPostNotFound", err)
	}
}
