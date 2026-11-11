package mwanachamacatalog_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

func entryManager(t *testing.T) catalog.CatalogManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := catalog.SpecFor("entrycover", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := spec.Migrate(db, s); err != nil {
		t.Fatal(err)
	}
	cm, err := catalog.NewCatalogManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return cm
}

func entry(slug string) catalog.Entry {
	return catalog.Entry{Slug: slug, Name: "Entry " + slug, Summary: "About " + slug, Doc: `{"sector":"health"}`, SubmittedBy: "miner-7"}
}

func TestANewEntryWaitsForReviewAndIsInvisibleToEveryoneUntilItIsPublic(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	made, err := cm.CreateEntry(ctx, catalog.Entry{Slug: "clinic", Name: "Clinic", Doc: `{"sector":"health"}`, Visibility: catalog.VisibilityPublic, ApprovedAt: "2020-01-01T00:00:00Z"})
	if err != nil {
		t.Fatal(err)
	}
	if made.Visibility != catalog.VisibilityPending || made.ApprovedAt != "" || made.ID == "" {
		t.Fatalf("a caller chose its own review state: %+v", made)
	}
	if _, err := cm.OpenEntry(ctx, "clinic", ""); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("a pending entry opened: %v", err)
	}
	if public, err := cm.ListPublicEntries(ctx, catalog.ListFilter{}); err != nil || len(public) != 0 {
		t.Fatalf("a pending entry was listed: %+v %v", public, err)
	}
	all, err := cm.ListEntries(ctx, catalog.ListFilter{})
	if err != nil || len(all) != 1 || all[0].Doc != "" {
		t.Fatalf("the staff list names the entry without its document: %+v %v", all, err)
	}
	if _, err := cm.CreateEntry(ctx, entry("clinic")); !errors.Is(err, catalog.ErrEntryExists) {
		t.Fatalf("a second entry took the slug: %v", err)
	}
}

func TestAnEntryIsRefusedWhenItsSlugDocumentOrDatesAreWrong(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	bad := []struct {
		name string
		edit func(*catalog.Entry)
	}{
		{"a slug with capitals", func(e *catalog.Entry) { e.Slug = "Clinic" }},
		{"a slug with a trailing dash", func(e *catalog.Entry) { e.Slug = "clinic-" }},
		{"no name", func(e *catalog.Entry) { e.Name = "" }},
		{"a name with a NUL byte", func(e *catalog.Entry) { e.Name = "a\x00b" }},
		{"a summary with a NUL byte", func(e *catalog.Entry) { e.Summary = "a\x00b" }},
		{"a document that is not an object", func(e *catalog.Entry) { e.Doc = `["a"]` }},
		{"a publish date that is not a date", func(e *catalog.Entry) { e.PublishAt = "next week" }},
		{"a dispose date that is not a date", func(e *catalog.Entry) { e.DisposeAt = "never" }},
	}
	for _, c := range bad {
		t.Run(c.name, func(t *testing.T) {
			e := entry("clinic")
			c.edit(&e)
			if _, err := cm.CreateEntry(ctx, e); !errors.Is(err, catalog.ErrInvalidEntry) {
				t.Fatalf("got %v", err)
			}
		})
	}
	if all, _ := cm.ListEntries(ctx, catalog.ListFilter{}); len(all) != 0 {
		t.Fatalf("a refused entry was kept: %+v", all)
	}
}

func TestOnlyAPublicEntryOpensWithoutAKeyAndItNeverNamesItsWriter(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	if _, err := cm.CreateEntry(ctx, entry("clinic")); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.SetVisibility(ctx, "clinic", catalog.VisibilityPublic); err != nil {
		t.Fatal(err)
	}
	opened, err := cm.OpenEntry(ctx, "clinic", "")
	if err != nil {
		t.Fatal(err)
	}
	if opened.SubmittedBy != "" || opened.Doc == "" || opened.ApprovedAt == "" {
		t.Fatalf("%+v", opened)
	}
	staff, err := cm.GetEntry(ctx, "clinic")
	if err != nil || staff.SubmittedBy != "miner-7" {
		t.Fatalf("staff read %+v %v", staff, err)
	}
	public, err := cm.ListPublicEntries(ctx, catalog.ListFilter{})
	if err != nil || len(public) != 1 || public[0].SubmittedBy != "" {
		t.Fatalf("%+v %v", public, err)
	}
	if _, err := cm.SetVisibility(ctx, "clinic", "secret"); !errors.Is(err, catalog.ErrInvalidEntry) {
		t.Fatalf("got %v", err)
	}
	if _, err := cm.SetVisibility(ctx, "nowhere", catalog.VisibilityPublic); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("got %v", err)
	}
	back, err := cm.SetVisibility(ctx, "clinic", catalog.VisibilityPending)
	if err != nil || back.ApprovedAt != "" {
		t.Fatalf("%+v %v", back, err)
	}
	if _, err := cm.OpenEntry(ctx, "clinic", ""); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("a pulled entry still opened: %v", err)
	}
}

func TestAPrivateEntryOpensOnlyWithALiveKeyAndAKeyDiesWhenTheEntryChanges(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	if _, err := cm.CreateEntry(ctx, entry("vault")); err != nil {
		t.Fatal(err)
	}
	if _, _, err := cm.IssueShareLink(ctx, "vault", "for the mayor", "staff"); !errors.Is(err, catalog.ErrNotPrivate) {
		t.Fatalf("a pending entry took a link: %v", err)
	}
	if _, err := cm.SetVisibility(ctx, "vault", catalog.VisibilityPrivate); err != nil {
		t.Fatal(err)
	}
	if _, _, err := cm.IssueShareLink(ctx, "vault", strings.Repeat("x", 500), "staff"); !errors.Is(err, catalog.ErrInvalidShareLink) {
		t.Fatalf("got %v", err)
	}
	link, key, err := cm.IssueShareLink(ctx, "vault", "for the mayor", "staff")
	if err != nil {
		t.Fatal(err)
	}
	if key == "" || link.Slug != "vault" {
		t.Fatalf("%+v", link)
	}
	if _, err := cm.OpenEntry(ctx, "vault", ""); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("a private entry opened without a key: %v", err)
	}
	if _, err := cm.OpenEntry(ctx, "vault", "wrong-key"); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("a private entry opened with a wrong key: %v", err)
	}
	opened, err := cm.OpenEntry(ctx, "vault", key)
	if err != nil || opened.SubmittedBy != "" {
		t.Fatalf("%+v %v", opened, err)
	}
	links, err := cm.ListShareLinks(ctx, "vault")
	if err != nil || len(links) != 1 {
		t.Fatalf("%+v %v", links, err)
	}

	changed := entry("vault")
	changed.Summary = "A new summary"
	if _, err := cm.UpdateEntry(ctx, changed); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.OpenEntry(ctx, "vault", key); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("an edited entry went back to review but its key still worked: %v", err)
	}
	if _, err := cm.RetireShareLink(ctx, "no-such-link"); !errors.Is(err, catalog.ErrShareLinkNotFound) {
		t.Fatalf("got %v", err)
	}
}

func TestEditingReviewedWordsSendsAPublicEntryBackToReviewButOtherEditsKeepIt(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	if _, err := cm.CreateEntry(ctx, entry("clinic")); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.SetVisibility(ctx, "clinic", catalog.VisibilityPublic); err != nil {
		t.Fatal(err)
	}
	same := entry("clinic")
	same.Doc = `{ "sector" : "health" }`
	kept, err := cm.UpdateEntry(ctx, same)
	if err != nil || kept.Visibility != catalog.VisibilityPublic {
		t.Fatalf("a document reformatted only: %+v %v", kept, err)
	}
	scheduled := entry("clinic")
	scheduled.DisposeAt = "2031-01-01T00:00:00Z"
	kept, err = cm.UpdateEntry(ctx, scheduled)
	if err != nil || kept.Visibility != catalog.VisibilityPublic || kept.DisposeAt != "2031-01-01T00:00:00Z" {
		t.Fatalf("only a dispose date changed: %+v %v", kept, err)
	}
	reworded := entry("clinic")
	reworded.Name = "Health clinic"
	back, err := cm.UpdateEntry(ctx, reworded)
	if err != nil || back.Visibility != catalog.VisibilityPending || back.ApprovedAt != "" {
		t.Fatalf("a renamed entry skipped review: %+v %v", back, err)
	}
	other := entry("clinic")
	other.ID = "someone-elses-id"
	if _, err := cm.UpdateEntry(ctx, other); !errors.Is(err, catalog.ErrSlugImmutable) {
		t.Fatalf("got %v", err)
	}
	if _, err := cm.UpdateEntry(ctx, entry("nowhere")); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("got %v", err)
	}
}

func TestUpsertCreatesOnceThenRewritesAndKeepsTheScheduledPublishDate(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	first := entry("clinic")
	first.PublishAt = "2020-01-01T00:00:00Z"
	made, err := cm.UpsertEntry(ctx, first)
	if err != nil || made.PublishAt != "" {
		t.Fatalf("an upsert chose its own publish date: %+v %v", made, err)
	}
	if _, err := cm.SchedulePublish(ctx, "clinic", "2027-05-05T10:00:00Z"); err != nil {
		t.Fatal(err)
	}
	second := entry("clinic")
	second.Name = "Clinic, renamed"
	second.PublishAt = "2020-01-01T00:00:00Z"
	again, err := cm.UpsertEntry(ctx, second)
	if err != nil || again.ID != made.ID || again.Name != "Clinic, renamed" || again.PublishAt != "2027-05-05T10:00:00Z" {
		t.Fatalf("%+v %v", again, err)
	}
	all, _ := cm.ListEntries(ctx, catalog.ListFilter{})
	if len(all) != 1 {
		t.Fatalf("an upsert made a second row: %+v", all)
	}
}

func TestAScheduledEntryIsHiddenUntilItsDateAndTheBatchRefusesWhatItCannotSchedule(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	for _, slug := range []string{"alpha", "beta"} {
		if _, err := cm.CreateEntry(ctx, entry(slug)); err != nil {
			t.Fatal(err)
		}
		if _, err := cm.SetVisibility(ctx, slug, catalog.VisibilityPublic); err != nil {
			t.Fatal(err)
		}
	}
	future := time.Now().UTC().Add(48 * time.Hour).Format(time.RFC3339)
	scheduled, err := cm.SchedulePublishBatch(ctx, catalog.PublishSchedule{Slugs: []string{"alpha", "alpha", "beta"}, PublishAt: future})
	if err != nil || len(scheduled) != 2 {
		t.Fatalf("%+v %v", scheduled, err)
	}
	if _, err := cm.OpenEntry(ctx, "alpha", ""); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("an entry opened before its date: %v", err)
	}
	if public, _ := cm.ListPublicEntries(ctx, catalog.ListFilter{}); len(public) != 0 {
		t.Fatalf("an entry was listed before its date: %+v", public)
	}
	if staff, _ := cm.ListEntries(ctx, catalog.ListFilter{}); len(staff) != 2 {
		t.Fatalf("staff must still see them: %+v", staff)
	}
	if _, err := cm.SchedulePublishBatch(ctx, catalog.PublishSchedule{PublishAt: future}); !errors.Is(err, catalog.ErrInvalidEntry) {
		t.Fatalf("an empty batch: %v", err)
	}
	if _, err := cm.SchedulePublishBatch(ctx, catalog.PublishSchedule{Slugs: []string{"alpha"}, PublishAt: "soon"}); !errors.Is(err, catalog.ErrInvalidEntry) {
		t.Fatalf("a bad date: %v", err)
	}
	if _, err := cm.SchedulePublishBatch(ctx, catalog.PublishSchedule{Slugs: []string{"alpha", "gamma"}, PublishAt: future}); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("an unknown slug: %v", err)
	}
	if _, err := cm.SchedulePublish(ctx, "alpha", ""); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.OpenEntry(ctx, "alpha", ""); err != nil {
		t.Fatalf("clearing the date did not release the entry: %v", err)
	}
}

func TestDeletingAnEntryFreesItsSlugAndRetiresItsKeysAndDisposalSweepsTheDue(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	if _, err := cm.CreateEntry(ctx, entry("vault")); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.SetVisibility(ctx, "vault", catalog.VisibilityPrivate); err != nil {
		t.Fatal(err)
	}
	_, key, err := cm.IssueShareLink(ctx, "vault", "", "staff")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := cm.PutPrivate(ctx, catalog.EntryPrivate{Slug: "vault", Readme: "notes"}); err != nil {
		t.Fatal(err)
	}
	if err := cm.DeleteEntry(ctx, "vault"); err != nil {
		t.Fatal(err)
	}
	if err := cm.DeleteEntry(ctx, "vault"); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("a second delete: %v", err)
	}
	if _, err := cm.OpenEntry(ctx, "vault", key); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("a deleted entry opened: %v", err)
	}
	if _, err := cm.CreateEntry(ctx, entry("vault")); err != nil {
		t.Fatalf("the slug stayed taken: %v", err)
	}

	for _, slug := range []string{"old-one", "old-two", "fresh"} {
		e := entry(slug)
		if slug != "fresh" {
			e.DisposeAt = "2025-01-01T00:00:00Z"
		}
		if _, err := cm.CreateEntry(ctx, e); err != nil {
			t.Fatal(err)
		}
	}
	gone, err := cm.DisposeExpired(ctx, time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
	if err != nil || len(gone) != 2 || gone[0] != "old-one" || gone[1] != "old-two" {
		t.Fatalf("%v %v", gone, err)
	}
	again, err := cm.DisposeExpired(ctx, time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
	if err != nil || len(again) != 0 {
		t.Fatalf("a second sweep disposed %v %v", again, err)
	}
}

func TestPrivatePartsMergeFieldByFieldAndAnUnstoredEntryReadsAsEmpty(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	if _, err := cm.CreateEntry(ctx, entry("clinic")); err != nil {
		t.Fatal(err)
	}
	empty, err := cm.GetPrivate(ctx, "clinic")
	if err != nil || empty.Slug != "clinic" || empty.Readme != "" {
		t.Fatalf("%+v %v", empty, err)
	}
	if _, err := cm.GetPrivate(ctx, "nowhere"); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("got %v", err)
	}
	if _, err := cm.PutPrivate(ctx, catalog.EntryPrivate{Slug: "nowhere", Readme: "x"}); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("got %v", err)
	}
	if _, err := cm.PutPrivate(ctx, catalog.EntryPrivate{Slug: "clinic", Rank: -1}); !errors.Is(err, catalog.ErrInvalidPrivate) {
		t.Fatalf("got %v", err)
	}
	if _, err := cm.PutPrivate(ctx, catalog.EntryPrivate{Slug: "clinic", ModuleConfigs: "[1]"}); !errors.Is(err, catalog.ErrInvalidPrivate) {
		t.Fatalf("got %v", err)
	}
	if _, err := cm.PutPrivate(ctx, catalog.EntryPrivate{Slug: "clinic", Readme: "first", Sales: "pitch", Rank: 3}); err != nil {
		t.Fatal(err)
	}
	merged, err := cm.PutPrivate(ctx, catalog.EntryPrivate{Slug: "clinic", Appeal: "warm"})
	if err != nil || merged.Readme != "first" || merged.Sales != "pitch" || merged.Appeal != "warm" || merged.Rank != 3 {
		t.Fatalf("a partial write dropped stored parts: %+v %v", merged, err)
	}
	cleared, err := cm.PutPrivate(ctx, catalog.EntryPrivate{Slug: "clinic", ClearRank: true})
	if err != nil || cleared.Rank != 0 || cleared.Readme != "first" {
		t.Fatalf("%+v %v", cleared, err)
	}
}

func TestListingFiltersByDocumentValueSearchTextVisibilityAndPage(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	add := func(slug, name, sector string) {
		e := catalog.Entry{Slug: slug, Name: name, Summary: "Plan for 50% savings", Doc: `{"_template":{"sector":"` + sector + `"}}`}
		if _, err := cm.CreateEntry(ctx, e); err != nil {
			t.Fatal(err)
		}
	}
	add("clinic", "Clinic", "health")
	add("market", "Market hall", "trade")
	add("pharmacy", "Pharmacy", "health")
	if _, err := cm.SetVisibility(ctx, "clinic", catalog.VisibilityPublic); err != nil {
		t.Fatal(err)
	}

	health, err := cm.ListEntries(ctx, catalog.ListFilter{Docs: []catalog.DocFilter{{Path: "_template.sector", Value: "health"}}})
	if err != nil || len(health) != 2 || health[0].Slug != "clinic" || health[1].Slug != "pharmacy" {
		t.Fatalf("%+v %v", health, err)
	}
	found, err := cm.ListEntries(ctx, catalog.ListFilter{Search: "  MARKET "})
	if err != nil || len(found) != 1 || found[0].Slug != "market" {
		t.Fatalf("%+v %v", found, err)
	}
	percent, err := cm.ListEntries(ctx, catalog.ListFilter{Search: "50%"})
	if err != nil || len(percent) != 3 {
		t.Fatalf("a literal percent sign: %+v %v", percent, err)
	}
	wild, err := cm.ListEntries(ctx, catalog.ListFilter{Search: "%"})
	if err != nil || len(wild) != 3 {
		t.Fatalf("%+v %v", wild, err)
	}
	none, err := cm.ListEntries(ctx, catalog.ListFilter{Search: "_____"})
	if err != nil || len(none) != 0 {
		t.Fatalf("an underscore matched as a wildcard: %+v %v", none, err)
	}
	pending, err := cm.ListEntries(ctx, catalog.ListFilter{Visibility: catalog.VisibilityPending})
	if err != nil || len(pending) != 2 {
		t.Fatalf("%+v %v", pending, err)
	}
	page, err := cm.ListEntries(ctx, catalog.ListFilter{Limit: 1, Offset: 1})
	if err != nil || len(page) != 1 || page[0].Slug != "market" {
		t.Fatalf("%+v %v", page, err)
	}
	if _, err := cm.ListEntries(ctx, catalog.ListFilter{Docs: []catalog.DocFilter{{Path: "a'; drop table x;--", Value: "y"}}}); !errors.Is(err, catalog.ErrInvalidDocPath) {
		t.Fatalf("an unsafe path reached the query: %v", err)
	}
	many := make([]catalog.DocFilter, 11)
	for i := range many {
		many[i] = catalog.DocFilter{Path: "a", Value: "b"}
	}
	if _, err := cm.ListEntries(ctx, catalog.ListFilter{Docs: many}); !errors.Is(err, catalog.ErrInvalidDocPath) {
		t.Fatalf("eleven filters: %v", err)
	}
}

func TestEndorsementsCountEachHolderOnceWhenTheDomainCountsThem(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	n, err := cm.Endorse(ctx, "mill-road", "amina")
	if errors.Is(err, catalog.ErrEndorsementsNotCounted) {
		if _, err := cm.CountEndorsements(ctx, "mill-road"); !errors.Is(err, catalog.ErrEndorsementsNotCounted) {
			t.Fatalf("got %v", err)
		}
		return
	}
	if err != nil || n != 1 {
		t.Fatalf("%d %v", n, err)
	}
	if n, err := cm.Endorse(ctx, "mill-road", "amina"); err != nil || n != 1 {
		t.Fatalf("a repeat endorsement counted twice: %d %v", n, err)
	}
	if n, err := cm.Endorse(ctx, "mill-road", "otieno"); err != nil || n != 2 {
		t.Fatalf("%d %v", n, err)
	}
	if _, err := cm.Endorse(ctx, "", "amina"); !errors.Is(err, catalog.ErrInvalidEndorsement) {
		t.Fatalf("got %v", err)
	}
	if _, err := cm.CountEndorsements(ctx, ""); !errors.Is(err, catalog.ErrInvalidEndorsement) {
		t.Fatalf("got %v", err)
	}
}
