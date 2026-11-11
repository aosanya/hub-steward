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

func overriddenManager(t *testing.T, overrides map[string]any) catalog.CatalogManager {
	t.Helper()
	cm, _, _ := overriddenManagerOn(t, overrides)
	return cm
}

func overriddenManagerOn(t *testing.T, overrides map[string]any) (catalog.CatalogManager, *gorm.DB, *spec.Spec) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := catalog.SpecFor("ledgers", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := spec.Migrate(db, s); err != nil {
		t.Fatal(err)
	}
	for name, value := range overrides {
		if _, err := spec.StoreOverride(db, s, name, value, "tester", "2026-01-01T00:00:00Z"); err != nil {
			t.Fatal(err)
		}
	}
	cm, err := catalog.NewCatalogManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return cm, db, s
}

func seedsOf(slugs ...string) []any {
	out := []any{}
	for _, slug := range slugs {
		out = append(out, map[string]any{"slug": slug, "name": "Seed " + slug, "summary": "About " + slug, "doc": map[string]any{"sector": "health"}})
	}
	return out
}

func TestSeedsCreateEachMissingEntryOnceAndLeaveExistingAndDeletedSlugsAlone(t *testing.T) {
	cm := overriddenManager(t, map[string]any{"seeds": seedsOf("clinic", "school", "market")})
	ctx := context.Background()

	if _, err := cm.CreateEntry(ctx, catalog.Entry{Slug: "school", Name: "Our school", Doc: `{}`}); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.CreateEntry(ctx, catalog.Entry{Slug: "market", Name: "Old market", Doc: `{}`}); err != nil {
		t.Fatal(err)
	}
	if err := cm.DeleteEntry(ctx, "market"); err != nil {
		t.Fatal(err)
	}

	created, err := cm.SeedEntries(ctx)
	if err != nil || len(created) != 1 || created[0] != "clinic" {
		t.Fatalf("only the clinic was missing, and a deleted slug stays gone: %v %v", created, err)
	}
	again, err := cm.SeedEntries(ctx)
	if err != nil || len(again) != 0 {
		t.Fatalf("a second pass created %v %v", again, err)
	}

	all, err := cm.ListEntries(ctx, catalog.ListFilter{})
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range all {
		if e.Slug == "clinic" && (e.Visibility != catalog.VisibilityPending || e.Name != "Seed clinic") {
			t.Fatalf("a seeded entry is not pending like any new entry: %+v", e)
		}
		if e.Slug == "school" && e.Name != "Our school" {
			t.Fatalf("a seed overwrote an entry that was there: %+v", e)
		}
	}
}

func TestMalformedSeedsAreIgnoredSoNothingIsCreated(t *testing.T) {
	cm := overriddenManager(t, map[string]any{"seeds": []any{map[string]any{"slug": "", "name": "No slug"}}})
	created, err := cm.SeedEntries(context.Background())
	if err != nil || len(created) != 0 {
		t.Fatalf("a malformed override created %v %v", created, err)
	}
	none, err := overriddenManager(t, nil).SeedEntries(context.Background())
	if err != nil || len(none) != 0 {
		t.Fatalf("a mount with no seeds created %v %v", none, err)
	}
}

func TestAScopeFigureReadsAsItsLatestAsOfDateAndListsNewestFirst(t *testing.T) {
	cm := overriddenManager(t, nil)
	ctx := context.Background()

	for _, f := range []catalog.ScopeFigure{
		{ScopeID: "ward-3", Value: 1200, AsOf: "2026-01-01T00:00:00Z", Source: "census", RecordedBy: "clerk-1"},
		{ScopeID: "ward-3", Value: 1500, AsOf: "2026-06-01T02:00:00+02:00", Source: "register", RecordedBy: "clerk-1"},
		{ScopeID: "ward-3", Value: 1300, AsOf: "2026-03-01T00:00:00Z", Source: "survey", RecordedBy: "clerk-2"},
		{ScopeID: "ward-4", Value: 90, AsOf: "2026-02-01T00:00:00Z", Source: "census", RecordedBy: "clerk-1"},
	} {
		got, err := cm.RecordScopeFigure(ctx, f)
		if err != nil || got.ID == "" || got.CreatedAt == "" {
			t.Fatalf("record %+v: %+v %v", f, got, err)
		}
	}

	current, err := cm.CurrentScopeFigure(ctx, "ward-3")
	if err != nil || current.Value != 1500 || current.AsOf != "2026-06-01T00:00:00Z" {
		t.Fatalf("the latest as-of date wins, written in UTC: %+v %v", current, err)
	}
	listed, err := cm.ListScopeFigures(ctx, "ward-3")
	if err != nil || len(listed) != 3 || listed[0].Value != 1500 || listed[1].Value != 1300 || listed[2].Value != 1200 {
		t.Fatalf("figures are not newest first: %+v %v", listed, err)
	}
	if _, err := cm.CurrentScopeFigure(ctx, "ward-9"); !errors.Is(err, catalog.ErrScopeFigureNotFound) {
		t.Fatalf("a scope with no figure had one: %v", err)
	}
}

func TestAScopeFigureIsRefusedWhenNegativeUndatedOrWithoutAScope(t *testing.T) {
	cm := overriddenManager(t, nil)
	ctx := context.Background()
	good := catalog.ScopeFigure{ScopeID: "ward-3", Value: 10, AsOf: "2026-01-01T00:00:00Z", Source: "census", RecordedBy: "clerk-1"}

	negative := good
	negative.Value = -1
	undated := good
	undated.AsOf = "last spring"
	unsourced := good
	unsourced.Source = ""
	for name, f := range map[string]catalog.ScopeFigure{"negative": negative, "undated": undated, "unsourced": unsourced} {
		if _, err := cm.RecordScopeFigure(ctx, f); !errors.Is(err, catalog.ErrInvalidScopeFigure) {
			t.Fatalf("%s figure was taken: %v", name, err)
		}
	}
	if _, err := cm.CurrentScopeFigure(ctx, ""); !errors.Is(err, catalog.ErrInvalidScopeFigure) {
		t.Fatalf("the current figure of no scope: %v", err)
	}
	if _, err := cm.ListScopeFigures(ctx, ""); !errors.Is(err, catalog.ErrInvalidScopeFigure) {
		t.Fatalf("the figures of no scope: %v", err)
	}
}

func TestARaisedItemIsOverdueOnceItsAnswerClockOfWorkingDaysHasRunOutAndNoOneAnswered(t *testing.T) {
	cm := overriddenManager(t, nil)
	ctx := context.Background()
	waiting := raise(t, cm, "Waiting", true)
	answered := raise(t, cm, "Answered", true)
	removed := raise(t, cm, "Removed", true)
	if _, err := cm.ReplyToRaisedItem(ctx, catalog.Reply{RaisedItemID: answered.ID, Body: "Seen", RepliedBy: "clerk-1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.RemoveRaisedItem(ctx, catalog.Removal{RaisedItemID: removed.ID, Ground: "Spam", RemovedBy: "moderator-1"}); err != nil {
		t.Fatal(err)
	}
	filed, err := time.Parse(time.RFC3339, waiting.CreatedAt)
	if err != nil {
		t.Fatal(err)
	}

	early, err := cm.ListOverdueRaisedItems(ctx, filed.AddDate(0, 0, 11).Format(time.RFC3339))
	if err != nil || len(early) != 0 {
		t.Fatalf("ten working days take at least twelve calendar days: %+v %v", early, err)
	}
	late, err := cm.ListOverdueRaisedItems(ctx, filed.AddDate(0, 0, 15).Format(time.RFC3339))
	if err != nil || len(late) != 1 || late[0].ID != waiting.ID {
		t.Fatalf("only the unanswered, unremoved item is overdue: %+v %v", late, err)
	}
	if now, err := cm.ListOverdueRaisedItems(ctx, ""); err != nil || len(now) != 0 {
		t.Fatalf("an item filed just now is overdue: %+v %v", now, err)
	}
	if _, err := cm.ListOverdueRaisedItems(ctx, "next week"); !errors.Is(err, catalog.ErrInvalidRaisedItem) {
		t.Fatalf("an unreadable time was taken: %v", err)
	}
}

func TestTheAnswerClockCanBeShortenedAndABadClockIsRefused(t *testing.T) {
	cm := overriddenManager(t, nil)
	ctx := context.Background()
	item := raise(t, cm, "Waiting", true)
	filed, err := time.Parse(time.RFC3339, item.CreatedAt)
	if err != nil {
		t.Fatal(err)
	}
	at := filed.AddDate(0, 0, 8).Format(time.RFC3339)

	if before, err := cm.ListOverdueRaisedItems(ctx, at); err != nil || len(before) != 0 {
		t.Fatalf("the default clock ran out in eight days: %+v %v", before, err)
	}
	if _, err := cm.PutSetting(ctx, catalog.AnswerClockSetting, "3"); err != nil {
		t.Fatal(err)
	}
	if after, err := cm.ListOverdueRaisedItems(ctx, at); err != nil || len(after) != 1 {
		t.Fatalf("a three day clock did not make it overdue: %+v %v", after, err)
	}
	for _, bad := range []string{"0", "soon", "-2"} {
		if _, err := cm.PutSetting(ctx, catalog.AnswerClockSetting, bad); err != nil {
			t.Fatal(err)
		}
		if _, err := cm.ListOverdueRaisedItems(ctx, at); !errors.Is(err, catalog.ErrInvalidSetting) {
			t.Fatalf("a clock of %q was taken: %v", bad, err)
		}
	}
}

func TestRaisedItemsOfAnEntryAreListedBySubjectAndOnlyStaffCanNameTheSubject(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	clinic, err := cm.CreateEntry(ctx, entry("clinic"))
	if err != nil {
		t.Fatal(err)
	}
	about, err := cm.FileRaisedItem(ctx, catalog.RaisedItem{Title: "Queue is long", Topic: "Health", RaisedBy: "resident-1", SubjectID: clinic.ID})
	if err != nil {
		t.Fatal(err)
	}
	byResident, err := cm.RaiseItem(ctx, catalog.RaisedItem{Title: "Also long", Topic: "Health", RaisedBy: "resident-2", SubjectID: clinic.ID})
	if err != nil || byResident.SubjectID != "" {
		t.Fatalf("a resident chose the subject of their item: %+v %v", byResident, err)
	}

	listed, err := cm.ListRaisedItemsOfSubject(ctx, clinic.ID)
	if err != nil || len(listed) != 1 || listed[0].ID != about.ID {
		t.Fatalf("by subject: %+v %v", listed, err)
	}
	if _, err := cm.ListRaisedItemsOfSubject(ctx, ""); !errors.Is(err, catalog.ErrInvalidRaisedItem) {
		t.Fatalf("no subject was taken: %v", err)
	}
	if _, err := cm.FileRaisedItem(ctx, catalog.RaisedItem{Title: "About nothing", Topic: "Health", RaisedBy: "resident-1", SubjectID: "no-such-entry"}); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("an item about an entry that is not there was taken: %v", err)
	}
}

func TestMiningRunsAreKeptWithinTheirLimitsAndListedUpToTheCap(t *testing.T) {
	cm := overriddenManager(t, nil)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		got, err := cm.RecordRun(ctx, catalog.MiningRun{RunRef: "run", SubmittedBy: "miner-7", TemplatesFiled: i, Summary: "filed"})
		if err != nil || got.ID == "" || got.CreatedAt == "" {
			t.Fatalf("run %d: %+v %v", i, got, err)
		}
	}
	if _, err := cm.RecordRun(ctx, catalog.MiningRun{TemplatesFiled: -1}); !errors.Is(err, catalog.ErrInvalidRun) {
		t.Fatalf("a negative count was kept: %v", err)
	}
	if _, err := cm.RecordRun(ctx, catalog.MiningRun{Summary: strings.Repeat("x", 9<<10)}); !errors.Is(err, catalog.ErrInvalidRun) {
		t.Fatalf("a summary over its limit was kept: %v", err)
	}

	all, err := cm.ListRuns(ctx, 0)
	if err != nil || len(all) != 3 {
		t.Fatalf("the default limit lists every run here: %+v %v", all, err)
	}
	two, err := cm.ListRuns(ctx, 2)
	if err != nil || len(two) != 2 {
		t.Fatalf("a limit of two: %+v %v", two, err)
	}
	if huge, err := cm.ListRuns(ctx, 100000); err != nil || len(huge) != 3 {
		t.Fatalf("a huge limit is clamped, not refused: %+v %v", huge, err)
	}
}

func TestASettingIsSavedReplacedAndReadBackAndAnEmptyKeyIsRefused(t *testing.T) {
	cm := overriddenManager(t, nil)
	ctx := context.Background()

	if _, err := cm.GetSetting(ctx, "theme"); !errors.Is(err, catalog.ErrSettingNotFound) {
		t.Fatalf("a setting nobody saved was read: %v", err)
	}
	if _, err := cm.PutSetting(ctx, "", "x"); !errors.Is(err, catalog.ErrInvalidSetting) {
		t.Fatalf("an empty key was saved: %v", err)
	}
	if _, err := cm.PutSetting(ctx, "theme", "light"); err != nil {
		t.Fatal(err)
	}
	replaced, err := cm.PutSetting(ctx, "theme", "dark")
	if err != nil || replaced.Value != "dark" {
		t.Fatalf("replace: %+v %v", replaced, err)
	}
	got, err := cm.GetSetting(ctx, "theme")
	if err != nil || got.Value != "dark" || got.UpdatedAt == "" {
		t.Fatalf("read back: %+v %v", got, err)
	}
}

func TestPageViewsCountEachPageAndOnlyPublicEntriesAreCounted(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		if err := cm.RecordPageView(ctx, catalog.PageKindIndex, "ignored-slug"); err != nil {
			t.Fatal(err)
		}
	}
	if err := cm.RecordPageView(ctx, catalog.PageKindEntry, "clinic"); !errors.Is(err, catalog.ErrEntryNotFound) {
		t.Fatalf("a view of an entry that is not there was counted: %v", err)
	}
	if err := cm.RecordPageView(ctx, catalog.PageKind("sideways"), ""); !errors.Is(err, catalog.ErrInvalidPageView) {
		t.Fatalf("an unknown page kind was counted: %v", err)
	}

	views, err := cm.ListPageViews(ctx)
	if err != nil || len(views) != 1 || views[0].Views != 3 || views[0].Slug != "" {
		t.Fatalf("the front page has no slug and three views: %+v %v", views, err)
	}
}

func TestARecordIsKeptPerHolderAndScopeAndItsChangesAreLogged(t *testing.T) {
	cm := overriddenManager(t, nil)
	ctx := context.Background()

	first, err := cm.PutRecord(ctx, catalog.Record{SubjectID: "clinic", HolderID: "resident-1", ScopeID: "ward-3", Doc: `{"bags":4}`, Changes: "forged"})
	if err != nil || first.ID == "" || first.Changes == "forged" || !strings.HasPrefix(first.Changes, "[") {
		t.Fatalf("first: %+v %v", first, err)
	}
	second, err := cm.PutRecord(ctx, catalog.Record{SubjectID: "clinic", HolderID: "resident-1", ScopeID: "ward-3", Doc: `{"bags":6}`})
	if err != nil || second.ID != first.ID || second.Doc != `{"bags":6}` || strings.Count(second.Changes, `"`) != 4 {
		t.Fatalf("a second write replaces the document and logs a change: %+v %v", second, err)
	}
	if _, err := cm.PutRecord(ctx, catalog.Record{SubjectID: "clinic", HolderID: "resident-2", ScopeID: "ward-4", Doc: `{"bags":2}`}); err != nil {
		t.Fatal(err)
	}

	inWard, err := cm.ListRecords(ctx, "clinic", "ward-3")
	if err != nil || len(inWard) != 1 || inWard[0].HolderID != "resident-1" {
		t.Fatalf("one scope: %+v %v", inWard, err)
	}
	across, err := cm.ListRecords(ctx, "clinic", "")
	if err != nil || len(across) != 2 {
		t.Fatalf("every scope: %+v %v", across, err)
	}
	tallies, err := cm.CountRecords(ctx, "clinic", "")
	if err != nil || len(tallies) != 1 || tallies[0].Field != "bags" || tallies[0].Counted != 2 || tallies[0].Holders != 2 {
		t.Fatalf("tallies: %+v %v", tallies, err)
	}

	if _, err := cm.PutRecord(ctx, catalog.Record{SubjectID: "", HolderID: "resident-1", Doc: `{}`}); !errors.Is(err, catalog.ErrInvalidRecord) {
		t.Fatalf("a record about nothing: %v", err)
	}
	if _, err := cm.PutRecord(ctx, catalog.Record{SubjectID: "clinic", HolderID: "", Doc: `{}`}); !errors.Is(err, catalog.ErrInvalidRecord) {
		t.Fatalf("a record from nobody: %v", err)
	}
	if _, err := cm.ListRecords(ctx, "", ""); !errors.Is(err, catalog.ErrInvalidRecord) {
		t.Fatalf("records of nothing: %v", err)
	}
}

func TestWhenOneRecordPerHolderIsOnASecondStandingInAnotherScopeIsRefused(t *testing.T) {
	cm := overriddenManager(t, nil)
	ctx := context.Background()
	if _, err := cm.PutSetting(ctx, catalog.SettingOneRecordPerHolder, "true"); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.PutRecord(ctx, catalog.Record{SubjectID: "clinic", HolderID: "resident-1", ScopeID: "ward-3", Doc: `{"bags":4}`}); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.PutRecord(ctx, catalog.Record{SubjectID: "clinic", HolderID: "resident-1", ScopeID: "ward-3", Doc: `{"bags":5}`}); err != nil {
		t.Fatalf("the same standing was refused when it changed: %v", err)
	}
	if _, err := cm.PutRecord(ctx, catalog.Record{SubjectID: "clinic", HolderID: "resident-1", ScopeID: "ward-4", Doc: `{"bags":5}`}); !errors.Is(err, catalog.ErrRecordHolderSpoke) {
		t.Fatalf("a second standing was kept: %v", err)
	}
	if _, err := cm.PutRecord(ctx, catalog.Record{SubjectID: "school", HolderID: "resident-1", ScopeID: "ward-4", Doc: `{"bags":5}`}); err != nil {
		t.Fatalf("another subject was refused: %v", err)
	}
}
