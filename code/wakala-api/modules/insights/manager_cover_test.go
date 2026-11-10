package mwanachamainsights

import (
	"context"
	"errors"
	"testing"

	"wakalaserver/modules/insights/models"
)

func TestNewInsightManagerRefusesNoDatabase(t *testing.T) {
	_, _, s := sqliteManager(t)
	if _, err := NewInsightManager(nil, s); err == nil {
		t.Fatal("a manager without a database was made")
	}
}

func TestCreateInsightFillsIDTimeAndDefaultSource(t *testing.T) {
	im, _, _ := sqliteManager(t)
	got, err := im.CreateInsight(context.Background(), models.Insight{Summary: "slow import", Repo: "hub-steward"})
	if err != nil {
		t.Fatal(err)
	}
	if got.ID == "" || got.CreatedAt == "" {
		t.Fatalf("%+v", got)
	}
	if got.Source != models.SourceAuto {
		t.Fatalf("source = %q", got.Source)
	}
	read, err := im.GetInsight(context.Background(), got.ID)
	if err != nil {
		t.Fatal(err)
	}
	if read.Summary != "slow import" || read.Repo != "hub-steward" || read.Source != models.SourceAuto {
		t.Fatalf("%+v", read)
	}
}

func TestCreateInsightKeepsAGivenSource(t *testing.T) {
	im, _, _ := sqliteManager(t)
	got, err := im.CreateInsight(context.Background(), models.Insight{Summary: "s", Source: models.SourceUser})
	if err != nil {
		t.Fatal(err)
	}
	if got.Source != models.SourceUser {
		t.Fatalf("source = %q", got.Source)
	}
}

func TestCreateInsightRefusesWhatTheBlueprintRefuses(t *testing.T) {
	im, _, _ := sqliteManager(t)
	for name, in := range map[string]models.Insight{
		"no summary":     {Repo: "r"},
		"blank summary":  {Summary: "   "},
		"unknown source": {Summary: "s", Source: "robot"},
	} {
		_, err := im.CreateInsight(context.Background(), in)
		if !errors.Is(err, ErrInvalidInsight) {
			t.Fatalf("%s: err = %v", name, err)
		}
	}
	all, err := im.ListInsights(context.Background(), InsightFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 0 {
		t.Fatalf("a refused insight was stored: %+v", all)
	}
}

func TestGetInsightNamesAMissingOne(t *testing.T) {
	im, _, _ := sqliteManager(t)
	if _, err := im.GetInsight(context.Background(), "nope"); !errors.Is(err, ErrInsightNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func TestListInsightsFiltersAndPutsNewestFirst(t *testing.T) {
	im, _, _ := sqliteManager(t)
	tickingClock(im)
	ctx := context.Background()
	for _, in := range []models.Insight{
		{Summary: "first", Repo: "app", SubjectID: "ward-a"},
		{Summary: "second", Repo: "api", SubjectID: "ward-a"},
		{Summary: "third", Repo: "app", SubjectID: "ward-b"},
	} {
		if _, err := im.CreateInsight(ctx, in); err != nil {
			t.Fatal(err)
		}
	}
	summaries := func(f InsightFilter) []string {
		list, err := im.ListInsights(ctx, f)
		if err != nil {
			t.Fatal(err)
		}
		var out []string
		for _, in := range list {
			out = append(out, in.Summary)
		}
		return out
	}
	want := func(got []string, expected ...string) {
		t.Helper()
		if len(got) != len(expected) {
			t.Fatalf("got %v, want %v", got, expected)
		}
		for i := range got {
			if got[i] != expected[i] {
				t.Fatalf("got %v, want %v", got, expected)
			}
		}
	}
	want(summaries(InsightFilter{}), "third", "second", "first")
	want(summaries(InsightFilter{Repo: "app"}), "third", "first")
	want(summaries(InsightFilter{SubjectID: "ward-a"}), "second", "first")
	want(summaries(InsightFilter{Repo: "app", SubjectID: "ward-a"}), "first")
	want(summaries(InsightFilter{Repo: "none"}))
}

func TestNotesBelongToAnExistingInsightAndListOldestFirst(t *testing.T) {
	im, _, _ := sqliteManager(t)
	tickingClock(im)
	ctx := context.Background()
	if _, err := im.CreateInsightNote(ctx, models.InsightNote{InsightID: "ghost", Text: "hello"}); !errors.Is(err, ErrInsightNotFound) {
		t.Fatalf("err = %v", err)
	}
	in, err := im.CreateInsight(ctx, models.Insight{Summary: "s"})
	if err != nil {
		t.Fatal(err)
	}
	for _, text := range []string{"one", "two"} {
		n, err := im.CreateInsightNote(ctx, models.InsightNote{InsightID: in.ID, Text: text})
		if err != nil {
			t.Fatal(err)
		}
		if n.ID == "" || n.CreatedAt == "" || n.Source != models.SourceAuto {
			t.Fatalf("%+v", n)
		}
	}
	if _, err := im.CreateInsightNote(ctx, models.InsightNote{InsightID: in.ID}); !errors.Is(err, ErrInvalidInsightNote) {
		t.Fatalf("err = %v", err)
	}
	if _, err := im.CreateInsightNote(ctx, models.InsightNote{Text: "orphan"}); !errors.Is(err, ErrInvalidInsightNote) {
		t.Fatalf("err = %v", err)
	}
	list, err := im.ListInsightNotes(ctx, in.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 || list[0].Text != "one" || list[1].Text != "two" {
		t.Fatalf("%+v", list)
	}
	other, err := im.ListInsightNotes(ctx, "elsewhere")
	if err != nil || len(other) != 0 {
		t.Fatalf("%+v %v", other, err)
	}
}

func TestProvisionTwiceIsHarmless(t *testing.T) {
	im, db, s := sqliteManager(t)
	if _, err := im.CreateInsight(context.Background(), models.Insight{Summary: "kept"}); err != nil {
		t.Fatal(err)
	}
	if err := Provision(db, s); err != nil {
		t.Fatal(err)
	}
	list, err := im.ListInsights(context.Background(), InsightFilter{})
	if err != nil || len(list) != 1 {
		t.Fatalf("%+v %v", list, err)
	}
}
