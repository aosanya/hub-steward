package mwanachamacatalog_test

import (
	"context"
	"errors"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

func serviceManager(t *testing.T) catalog.CatalogManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := catalog.SpecFor("servicekinds", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := spec.Migrate(db, s); err != nil {
		t.Fatal(err)
	}
	kinds := []any{
		map[string]any{"name": "permit", "fields": []any{}},
		map[string]any{"name": "licence", "fields": []any{}},
		map[string]any{"name": "fee", "fields": []any{}},
	}
	if _, err := spec.StoreOverride(db, s, "kinds", kinds, "steward", "2026-11-16T00:00:00Z"); err != nil {
		t.Fatal(err)
	}
	cm, err := catalog.NewCatalogManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return cm
}

func TestAnEntryWrittenWithAKindAndAFormReadsAndListsBackWithBoth(t *testing.T) {
	cm := serviceManager(t)
	ctx := context.Background()
	if _, err := cm.UpsertEntry(ctx, catalog.Entry{Slug: "building-permit", Name: "Building permit", Kind: "permit", FormID: "form-1", Doc: `{"fee":120}`, SubmittedBy: "owner"}); err != nil {
		t.Fatal(err)
	}
	got, err := cm.GetEntry(ctx, "building-permit")
	if err != nil || got.Kind != "permit" || got.FormID != "form-1" {
		t.Fatalf("read: %+v %v", got, err)
	}
	cards, err := cm.ListEntries(ctx, catalog.ListFilter{})
	if err != nil || len(cards) != 1 || cards[0].Kind != "permit" || cards[0].FormID != "form-1" || cards[0].Doc != "" {
		t.Fatalf("list: %+v %v", cards, err)
	}
}

func TestListByKindKeepsOnlyThatKind(t *testing.T) {
	cm := serviceManager(t)
	ctx := context.Background()
	for slug, kind := range map[string]string{"a": "permit", "b": "licence", "c": "fee", "d": "permit"} {
		if _, err := cm.UpsertEntry(ctx, catalog.Entry{Slug: slug, Name: slug, Kind: kind, SubmittedBy: "owner"}); err != nil {
			t.Fatal(err)
		}
	}
	permits, err := cm.ListEntries(ctx, catalog.ListFilter{Kind: "permit"})
	if err != nil || len(permits) != 2 {
		t.Fatalf("permits: %+v %v", permits, err)
	}
	if none, err := cm.ListEntries(ctx, catalog.ListFilter{Kind: "tax"}); err != nil || len(none) != 0 {
		t.Fatalf("tax: %+v %v", none, err)
	}
}

func TestAnUnknownKindOrAFormIDThatIsNotTextIsRefused(t *testing.T) {
	cm := serviceManager(t)
	ctx := context.Background()
	if _, err := cm.UpsertEntry(ctx, catalog.Entry{Slug: "x", Name: "x", Kind: "tax", SubmittedBy: "owner"}); !errors.Is(err, catalog.ErrEntryKind) {
		t.Fatalf("unknown kind: %v", err)
	}
	if _, err := cm.UpsertEntry(ctx, catalog.Entry{Slug: "y", Name: "y", Doc: `{"form_id":7}`, SubmittedBy: "owner"}); !errors.Is(err, catalog.ErrInvalidEntry) {
		t.Fatalf("numeric form_id: %v", err)
	}
}

func TestChangingTheKindOfAnEntryRewritesItsDocument(t *testing.T) {
	cm := serviceManager(t)
	ctx := context.Background()
	if _, err := cm.UpsertEntry(ctx, catalog.Entry{Slug: "s", Name: "s", Kind: "permit", FormID: "f", SubmittedBy: "owner"}); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.UpsertEntry(ctx, catalog.Entry{Slug: "s", Name: "s", Kind: "fee", FormID: "f", SubmittedBy: "owner"}); err != nil {
		t.Fatal(err)
	}
	got, _ := cm.GetEntry(ctx, "s")
	if got.Kind != "fee" || got.FormID != "f" {
		t.Fatalf("%+v", got)
	}
}
