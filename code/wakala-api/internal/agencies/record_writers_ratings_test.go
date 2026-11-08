package agencies

import (
	"context"
	"strings"
	"testing"

	"gorm.io/gorm"

	"wakalaserver/internal/specs"
	mwanachamaforms "wakalaserver/modules/forms"
	mwanachamaratings "wakalaserver/modules/ratings"
)

func newRatingsFixture(t *testing.T, db *gorm.DB) (mwanachamaratings.RatingsManager, ratingWriter) {
	t.Helper()
	raw, err := specs.For(mwanachamaratings.Module, "landing")
	if err != nil {
		t.Fatal(err)
	}
	s, err := mwanachamaratings.ParseSpec(raw)
	if err != nil {
		t.Fatal(err)
	}
	if err := mwanachamaratings.Provision(db, s); err != nil {
		t.Fatal(err)
	}
	rm, err := mwanachamaratings.NewRatingsManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return rm, ratingWriter{ratings: func(context.Context) (mwanachamaratings.RatingsManager, error) { return rm, nil }}
}

func rating(member string, fields map[string]any) mwanachamaforms.LandedRecord {
	return mwanachamaforms.LandedRecord{Record: "ratings.rating", Key: map[string]string{"member": member}, Fields: fields}
}

func TestRatingWriterGivesTheRatingAsTheMemberAndAResendUpdatesIt(t *testing.T) {
	rm, w := newRatingsFixture(t, sqliteDB(t))
	ctx := context.Background()
	for _, value := range []any{0.4, "0.9"} {
		if err := w.Write(ctx, rating("mem-1", map[string]any{"item": "market-stall-12", "value": value})); err != nil {
			t.Fatal(err)
		}
	}
	got, err := rm.GetRating(ctx, "mem-1", "market-stall-12")
	if err != nil || got.Value != 0.9 {
		t.Fatalf("rating = %+v (%v), want value 0.9 from the second send", got, err)
	}
	list, err := rm.ListRatings(ctx, mwanachamaratings.RatingFilter{Item: "market-stall-12"})
	if err != nil || len(list) != 1 {
		t.Fatalf("ratings = %+v (%v), want one: a resend updates", list, err)
	}
}

func TestRatingWriterNeverLetsAFormRateAsSomeoneElse(t *testing.T) {
	rm, w := newRatingsFixture(t, sqliteDB(t))
	ctx := context.Background()
	err := w.Write(ctx, rating("mem-1", map[string]any{"item": "market-stall-12", "value": 0.5, "rater": "mem-2"}))
	if err == nil || !strings.Contains(err.Error(), "rater") || !strings.Contains(err.Error(), "item, value") {
		t.Fatalf("err = %v, want a refusal naming the field and the ones allowed", err)
	}
	if _, err := rm.GetRating(ctx, "mem-2", "market-stall-12"); err == nil {
		t.Fatal("a rating was written for another member")
	}
	unkeyed := mwanachamaforms.LandedRecord{Record: "ratings.rating", Key: map[string]string{"form": "f-1"}, Fields: map[string]any{"item": "x", "value": 0.5}}
	if err := w.Write(ctx, unkeyed); err == nil {
		t.Fatal("a rating with no member in the key was written")
	}
}

func TestRatingWriterRefusesWhatIsNotAnItemAndAValueInRange(t *testing.T) {
	_, w := newRatingsFixture(t, sqliteDB(t))
	ctx := context.Background()
	for name, fields := range map[string]map[string]any{
		"no item":     {"value": 0.5},
		"blank item":  {"item": "  ", "value": 0.5},
		"no value":    {"item": "stall"},
		"word value":  {"item": "stall", "value": "high"},
		"above range": {"item": "stall", "value": 1.5},
		"below range": {"item": "stall", "value": -0.1},
		"bool value":  {"item": "stall", "value": true},
	} {
		if err := w.Write(ctx, rating("mem-1", fields)); err == nil {
			t.Fatalf("%s: written", name)
		}
	}
	other := rating("mem-1", map[string]any{"item": "stall", "value": 0.5})
	other.Record = "ratings.review"
	if err := w.Write(ctx, other); err == nil {
		t.Fatal("a record this writer does not take was written")
	}
}
