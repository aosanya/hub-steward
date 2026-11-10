package mwanachamainsights

import (
	"context"
	"errors"
	"testing"

	"wakalaserver/modules/insights/models"
	"wakalaserver/modules/shared/disclosure"
	"wakalaserver/modules/shared/spec"
)

func settingLayers(value any) SettingsLayers {
	return func(ctx context.Context) (map[string]any, map[string]spec.Override, error) {
		if value == nil {
			return nil, nil, nil
		}
		return map[string]any{"minimum_count": value}, nil, nil
	}
}

func TestMinimumCountIsTheBuiltInFiveWithoutSettings(t *testing.T) {
	im, _, _ := sqliteManager(t)
	got, err := im.MinimumCount(context.Background())
	if err != nil || got != DefaultMinimumCount {
		t.Fatalf("%d %v", got, err)
	}
}

func TestMinimumCountReadsTheSettingsWhateverNumberTypeItArrivesAs(t *testing.T) {
	im, _, _ := sqliteManager(t)
	for name, value := range map[string]any{"int": 8, "int64": int64(8), "float64": float64(8)} {
		im.UseSettings(settingLayers(value))
		got, err := im.MinimumCount(context.Background())
		if err != nil || got != 8 {
			t.Fatalf("%s: %d %v", name, got, err)
		}
	}
}

func TestMinimumCountBelowTwoFallsBackToFive(t *testing.T) {
	im, _, _ := sqliteManager(t)
	for _, value := range []any{0, 1, int64(1), float64(1)} {
		im.UseSettings(settingLayers(value))
		got, err := im.MinimumCount(context.Background())
		if err != nil || got != DefaultMinimumCount {
			t.Fatalf("%v: %d %v", value, got, err)
		}
	}
}

func TestMinimumCountOfASettingNobodySetIsTheBlueprintDefault(t *testing.T) {
	im, _, _ := sqliteManager(t)
	im.UseSettings(settingLayers(nil))
	got, err := im.MinimumCount(context.Background())
	if err != nil || got != DefaultMinimumCount {
		t.Fatalf("%d %v", got, err)
	}
}

func TestMinimumCountReportsAFailingSettingsRead(t *testing.T) {
	im, _, _ := sqliteManager(t)
	boom := errors.New("settings are down")
	im.UseSettings(func(ctx context.Context) (map[string]any, map[string]spec.Override, error) {
		return nil, nil, boom
	})
	if _, err := im.MinimumCount(context.Background()); !errors.Is(err, boom) {
		t.Fatalf("err = %v", err)
	}
	if _, err := im.CountInsightsBySubject(context.Background()); !errors.Is(err, boom) {
		t.Fatalf("counts err = %v", err)
	}
}

func TestSetMinimumCountPinsTheNumberAndRefusesLessThanTwo(t *testing.T) {
	im, _, _ := sqliteManager(t)
	im.UseSettings(settingLayers(9))
	if err := SetMinimumCount(im, 1); !errors.Is(err, disclosure.ErrThreshold) {
		t.Fatalf("err = %v", err)
	}
	if err := SetMinimumCount(im, 3); err != nil {
		t.Fatal(err)
	}
	got, err := im.MinimumCount(context.Background())
	if err != nil || got != 3 {
		t.Fatalf("a pinned minimum must win over the settings: %d %v", got, err)
	}
}

func TestSetMinimumCountRefusesAManagerThatIsNotOurs(t *testing.T) {
	if err := SetMinimumCount(nil, 3); err == nil {
		t.Fatal("a nil manager was accepted")
	}
}

func seed(t *testing.T, im InsightManager, subject string, n int) {
	t.Helper()
	for i := 0; i < n; i++ {
		if _, err := im.CreateInsight(context.Background(), models.Insight{Summary: "s", SubjectID: subject}); err != nil {
			t.Fatal(err)
		}
	}
}

func TestCountsBySubjectFoldSmallSubjectsAtTheConfiguredMinimum(t *testing.T) {
	im, _, _ := sqliteManager(t)
	seed(t, im, "ward-a", 6)
	seed(t, im, "ward-b", 4)
	seed(t, im, "ward-c", 3)
	got, err := im.CountInsightsBySubject(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if got.Minimum != DefaultMinimumCount || got.Total != 13 || !got.TotalPublished {
		t.Fatalf("%+v", got)
	}
	if len(got.Items) != 2 || got.Items[0].SubjectID != "ward-a" || got.Items[0].Count != 6 {
		t.Fatalf("%+v", got.Items)
	}
	if got.Items[1].SubjectID != "other" || got.Items[1].Count != 7 || got.Items[1].Suppressed {
		t.Fatalf("%+v", got.Items)
	}
}

func TestCountsBySubjectPublishEverySubjectWhenTheMinimumIsLow(t *testing.T) {
	im, _, _ := sqliteManager(t)
	seed(t, im, "ward-a", 2)
	seed(t, im, "ward-b", 3)
	if err := SetMinimumCount(im, 2); err != nil {
		t.Fatal(err)
	}
	got, err := im.CountInsightsBySubject(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if got.Minimum != 2 || len(got.Items) != 2 || got.Total != 5 {
		t.Fatalf("%+v", got)
	}
	for _, item := range got.Items {
		if item.Suppressed {
			t.Fatalf("%+v", got.Items)
		}
	}
}

func TestCountsOfNothingAreEmptyNotAnError(t *testing.T) {
	im, _, _ := sqliteManager(t)
	got, err := CountBySubject(context.Background(), im, 5)
	if err != nil || len(got.Items) != 0 || got.Total != 0 {
		t.Fatalf("%+v %v", got, err)
	}
}

func TestDiscloseBySubjectRefusesAThresholdBelowTwo(t *testing.T) {
	if _, err := DiscloseBySubject(many("ward-a", 4), 1); !errors.Is(err, disclosure.ErrThreshold) {
		t.Fatalf("err = %v", err)
	}
}
