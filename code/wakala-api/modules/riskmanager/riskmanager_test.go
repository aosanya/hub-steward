package riskmanager_test

import (
	"context"
	"errors"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	rm "wakalaserver/modules/riskmanager"
	"wakalaserver/modules/shared/identity"
)

type fakeOwners map[string]bool

func (f fakeOwners) StableIdentity(ctx context.Context, object, id string) (string, error) {
	return id, nil
}

func (f fakeOwners) Resolve(ctx context.Context, raw string) (string, string, error) {
	if !f[raw] {
		return "", "", identity.ErrNotFound
	}
	return "actor", raw, nil
}

func newManager(t *testing.T, opts ...rm.Option) rm.RiskManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	s, err := rm.SpecForMount("test", "risks")
	if err != nil {
		t.Fatalf("SpecForMount: %v", err)
	}
	if err := rm.Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	m, err := rm.NewRiskManager(db, s, opts...)
	if err != nil {
		t.Fatalf("NewRiskManager: %v", err)
	}
	return m
}

func TestARiskReadsBackAsDraft(t *testing.T) {
	ctx := context.Background()
	m := newManager(t)
	r, err := m.CreateRisk(ctx, rm.Risk{Title: "Flooded depot", TopEvent: "Depot floods"})
	if err != nil {
		t.Fatalf("CreateRisk: %v", err)
	}
	got, err := m.GetRisk(ctx, r.ID)
	if err != nil || got.Status != "draft" || got.Title != "Flooded depot" {
		t.Fatalf("GetRisk = %+v, %v", got, err)
	}
}

func TestAnUnknownRiskIsNotFound(t *testing.T) {
	if _, err := newManager(t).GetRisk(context.Background(), "nope"); !errors.Is(err, rm.ErrRiskNotFound) {
		t.Fatalf("err = %v, want ErrRiskNotFound", err)
	}
}

func TestAnUnknownOwnerIsAnInvalidReference(t *testing.T) {
	ctx := context.Background()
	m := newManager(t, rm.WithOwners(fakeOwners{"a-1": true}, "actor"))
	if _, err := m.CreateRisk(ctx, rm.Risk{Title: "T", TopEvent: "E", Owner: "ghost"}); !errors.Is(err, rm.ErrInvalidReference) {
		t.Fatalf("err = %v, want ErrInvalidReference", err)
	}
	if _, err := m.CreateRisk(ctx, rm.Risk{Title: "T", TopEvent: "E", Owner: "a-1"}); err != nil {
		t.Fatalf("known owner: %v", err)
	}
}

func TestOperationsAreDeclared(t *testing.T) {
	if len(rm.Operations()) == 0 {
		t.Fatal("no operations")
	}
}
