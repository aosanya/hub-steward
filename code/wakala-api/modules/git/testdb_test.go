package mwanachamagit

import (
	"context"
	"path/filepath"
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func newTestManager(t *testing.T) *gitManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}

	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxOpenConns(1)
	}
	s, err := LoadSpec(filepath.Join("spec", "examples", "engineering.git.json"))
	if err != nil {
		t.Fatalf("LoadSpec: %v", err)
	}
	if err := Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	st, err := newStore(db, s)
	if err != nil {
		t.Fatalf("newStore: %v", err)
	}
	return &gitManager{db: db, store: st, tables: tablesOf(st), locker: &mutexLocker{}}
}

func newTestManagerWithPublisher(t *testing.T) (*gitManager, *fakePublisher) {
	t.Helper()
	m := newTestManager(t)
	pub := &fakePublisher{}
	m.publisher = pub
	return m, pub
}

type publishedEvent struct {
	topic   string
	payload any
}

type fakePublisher struct {
	mu     sync.Mutex
	events []publishedEvent
}

func (p *fakePublisher) Publish(_ context.Context, topic string, payload any) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.events = append(p.events, publishedEvent{topic: topic, payload: payload})
	return nil
}

func (p *fakePublisher) published() []publishedEvent {
	p.mu.Lock()
	defer p.mu.Unlock()
	return append([]publishedEvent(nil), p.events...)
}

func countByTopic(events []publishedEvent, topic string) int {
	n := 0
	for _, e := range events {
		if e.topic == topic {
			n++
		}
	}
	return n
}

func hasTopic(events []publishedEvent, topic string) bool {
	return countByTopic(events, topic) > 0
}

func TestNewGitManager_NilDB(t *testing.T) {
	if _, err := NewGitManager(nil, nil, nil, nil, nil); err == nil {
		t.Fatal("expected error for nil db")
	}
}
