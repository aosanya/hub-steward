package http

import (
	"context"
	"errors"
	"testing"

	mwanachamainsights "github.com/aosanya/mwanachama-backend-insights"
	insightmodels "github.com/aosanya/mwanachama-backend-insights/models"
	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

type reachableRegistry struct {
	insightScopeRegistry
	reachable []string
	listErr   error
}

func (r reachableRegistry) InstancesFor(context.Context, string) ([]agencies.Instance, error) {
	if r.listErr != nil {
		return nil, r.listErr
	}
	out := []agencies.Instance{}
	for _, id := range r.reachable {
		out = append(out, agencies.Instance{ID: id})
	}
	return out, nil
}

type recordingInsights struct {
	mwanachamainsights.InsightManager
	insights  []insightmodels.Insight
	notes     []insightmodels.InsightNote
	minimum   int
	created   int
	noted     int
	listCalls []string
	settings  int
}

func (m *recordingInsights) CreateInsight(_ context.Context, in insightmodels.Insight) (insightmodels.Insight, error) {
	m.created++
	in.ID = "new"
	return in, nil
}

func (m *recordingInsights) GetInsight(_ context.Context, id string) (insightmodels.Insight, error) {
	for _, in := range m.insights {
		if in.ID == id {
			return in, nil
		}
	}
	return insightmodels.Insight{}, mwanachamainsights.ErrInsightNotFound
}

func (m *recordingInsights) ListInsights(_ context.Context, f mwanachamainsights.InsightFilter) ([]insightmodels.Insight, error) {
	m.listCalls = append(m.listCalls, f.SubjectID)
	out := []insightmodels.Insight{}
	for _, in := range m.insights {
		if f.SubjectID == "" || in.SubjectID == f.SubjectID {
			out = append(out, in)
		}
	}
	return out, nil
}

func (m *recordingInsights) MinimumCount(context.Context) (int, error) { return m.minimum, nil }

func (m *recordingInsights) UseSettings(mwanachamainsights.SettingsLayers) { m.settings++ }

func (m *recordingInsights) CreateInsightNote(_ context.Context, n insightmodels.InsightNote) (insightmodels.InsightNote, error) {
	m.noted++
	return n, nil
}

func (m *recordingInsights) ListInsightNotes(_ context.Context, id string) ([]insightmodels.InsightNote, error) {
	out := []insightmodels.InsightNote{}
	for _, n := range m.notes {
		if n.InsightID == id {
			out = append(out, n)
		}
	}
	return out, nil
}

func scopedFixture() (mwanachamainsights.InsightManager, *recordingInsights, context.Context) {
	reg := reachableRegistry{
		insightScopeRegistry: insightScopeRegistry{members: map[string]bool{"mine/carol": true, "also/carol": true}},
		reachable:            []string{"mine", "also"},
	}
	inner := &recordingInsights{
		insights: []insightmodels.Insight{
			{ID: "a", SubjectID: "mine"},
			{ID: "b", SubjectID: "theirs"},
			{ID: "c", SubjectID: "also"},
		},
		notes: []insightmodels.InsightNote{{InsightID: "a"}, {InsightID: "b"}},
	}
	return scopeInsightsToCaller(inner, reg), inner, accounts.WithID(context.Background(), "carol")
}

func TestScopeInsightsToCallerLeavesTheManagerAloneWithoutARegistryOrManager(t *testing.T) {
	inner := &recordingInsights{}
	if got := scopeInsightsToCaller(inner, nil); got != mwanachamainsights.InsightManager(inner) {
		t.Fatal("with no registry the manager must be returned as it is")
	}
	if got := scopeInsightsToCaller(nil, reachableRegistry{}); got != nil {
		t.Fatal("with no manager nothing is wrapped")
	}
}

func TestScopedInsightCreateRefusesAnAgencyTheCallerIsNotIn(t *testing.T) {
	im, inner, ctx := scopedFixture()
	if _, err := im.CreateInsight(ctx, insightmodels.Insight{SubjectID: "theirs"}); !errors.Is(err, agencies.ErrInstanceNotFound) {
		t.Fatalf("want instance not found, got %v", err)
	}
	if inner.created != 0 {
		t.Fatal("a refused create must not reach the store")
	}
	got, err := im.CreateInsight(ctx, insightmodels.Insight{SubjectID: "mine"})
	if err != nil || got.ID != "new" || inner.created != 1 {
		t.Fatalf("a member's create must pass, got %+v %v", got, err)
	}
	if _, err := im.CreateInsight(context.Background(), insightmodels.Insight{SubjectID: "mine"}); !errors.Is(err, agencies.ErrInstanceNotFound) {
		t.Fatalf("an anonymous caller must read as not found, got %v", err)
	}
}

func TestScopedInsightGetHidesAnotherAgencyBehindTheStoresOwnNotFound(t *testing.T) {
	im, _, ctx := scopedFixture()
	if got, err := im.GetInsight(ctx, "a"); err != nil || got.ID != "a" {
		t.Fatalf("own insight must open, got %+v %v", got, err)
	}
	if _, err := im.GetInsight(ctx, "b"); !errors.Is(err, mwanachamainsights.ErrInsightNotFound) {
		t.Fatalf("another agency's insight must be the store's not-found, got %v", err)
	}
	if _, err := im.GetInsight(ctx, "zzz"); !errors.Is(err, mwanachamainsights.ErrInsightNotFound) {
		t.Fatalf("a missing insight must be not found, got %v", err)
	}
}

func TestScopedInsightListNamedAgencyIsCheckedAndPassedThrough(t *testing.T) {
	im, inner, ctx := scopedFixture()
	got, err := im.ListInsights(ctx, mwanachamainsights.InsightFilter{SubjectID: "mine"})
	if err != nil || len(got) != 1 || got[0].ID != "a" {
		t.Fatalf("want only insight a, got %+v %v", got, err)
	}
	if _, err := im.ListInsights(ctx, mwanachamainsights.InsightFilter{SubjectID: "theirs"}); !errors.Is(err, agencies.ErrInstanceNotFound) {
		t.Fatalf("listing another agency must read as not found, got %v", err)
	}
	if len(inner.listCalls) != 1 {
		t.Fatalf("the refused list must not reach the store, calls %v", inner.listCalls)
	}
}

func TestScopedInsightListWithoutAgencyReturnsOnlyReachableAgenciesInOrder(t *testing.T) {
	im, inner, ctx := scopedFixture()
	got, err := im.ListInsights(ctx, mwanachamainsights.InsightFilter{})
	if err != nil {
		t.Fatal(err)
	}
	ids := []string{}
	for _, in := range got {
		ids = append(ids, in.ID)
	}
	if len(ids) != 2 || ids[0] != "a" || ids[1] != "c" {
		t.Fatalf("want insights a then c, never b, got %v", ids)
	}
	if len(inner.listCalls) != 2 || inner.listCalls[0] != "mine" || inner.listCalls[1] != "also" {
		t.Fatalf("each reachable agency is listed on its own, got %v", inner.listCalls)
	}
}

func TestScopedInsightListWithoutAgencyIsEmptyNotNilWhenNothingIsReachable(t *testing.T) {
	reg := reachableRegistry{}
	im := scopeInsightsToCaller(&recordingInsights{insights: []insightmodels.Insight{{ID: "x", SubjectID: "s"}}}, reg)
	got, err := im.ListInsights(accounts.WithID(context.Background(), "carol"), mwanachamainsights.InsightFilter{})
	if err != nil || got == nil || len(got) != 0 {
		t.Fatalf("want an empty non-nil list, got %#v %v", got, err)
	}
}

func TestScopedInsightListWithoutAgencyRefusesAnAnonymousCaller(t *testing.T) {
	im, _, _ := scopedFixture()
	if _, err := im.ListInsights(context.Background(), mwanachamainsights.InsightFilter{}); !errors.Is(err, agencies.ErrInstanceNotFound) {
		t.Fatalf("want instance not found, got %v", err)
	}
}

func TestScopedInsightListWithoutAgencyPassesTheRegistryFailureUp(t *testing.T) {
	boom := errors.New("registry down")
	im := scopeInsightsToCaller(&recordingInsights{}, reachableRegistry{listErr: boom})
	if _, err := im.ListInsights(accounts.WithID(context.Background(), "carol"), mwanachamainsights.InsightFilter{}); !errors.Is(err, boom) {
		t.Fatalf("want the registry error, got %v", err)
	}
}

func TestScopedInsightNotesFollowTheirInsightsAgency(t *testing.T) {
	im, inner, ctx := scopedFixture()
	if _, err := im.CreateInsightNote(ctx, insightmodels.InsightNote{InsightID: "b"}); !errors.Is(err, mwanachamainsights.ErrInsightNotFound) {
		t.Fatalf("a note on another agency's insight must read as not found, got %v", err)
	}
	if inner.noted != 0 {
		t.Fatal("a refused note must not be stored")
	}
	if _, err := im.CreateInsightNote(ctx, insightmodels.InsightNote{InsightID: "a"}); err != nil || inner.noted != 1 {
		t.Fatalf("a note on own insight must be stored, got %v", err)
	}
	notes, err := im.ListInsightNotes(ctx, "a")
	if err != nil || len(notes) != 1 {
		t.Fatalf("want one note on a, got %+v %v", notes, err)
	}
	if _, err := im.ListInsightNotes(ctx, "b"); !errors.Is(err, mwanachamainsights.ErrInsightNotFound) {
		t.Fatalf("notes of another agency's insight must read as not found, got %v", err)
	}
}

func TestScopedInsightCountsOnlyCoverTheCallersAgenciesAndForwardSettings(t *testing.T) {
	im, inner, ctx := scopedFixture()
	inner.minimum = 2
	inner.insights = append(inner.insights,
		insightmodels.Insight{ID: "a2", SubjectID: "mine"},
		insightmodels.Insight{ID: "b2", SubjectID: "theirs"},
		insightmodels.Insight{ID: "c2", SubjectID: "also"},
	)
	got, err := im.MinimumCount(ctx)
	if err != nil || got != 2 {
		t.Fatalf("want the store's minimum 2, got %d %v", got, err)
	}
	counts, err := im.CountInsightsBySubject(ctx)
	if err != nil {
		t.Fatal(err)
	}
	subjects := []string{}
	for _, item := range counts.Items {
		subjects = append(subjects, item.SubjectID)
	}
	if len(subjects) != 2 || subjects[0] != "also" || subjects[1] != "mine" || counts.Total != 4 {
		t.Fatalf("want only the caller's two agencies counted, got %+v", counts)
	}
	im.UseSettings(nil)
	if inner.settings != 1 {
		t.Fatal("settings must reach the store")
	}
}
