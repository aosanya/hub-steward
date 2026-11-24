package agencies

import (
	"context"
	"errors"
	"reflect"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
	ai "wakalaserver/modules/ai"
)

type fakeModuleSource struct {
	scenario    models.Scenario
	scenarioErr error
	modules     []models.Module
	listErr     error
	listedDraft string
	gotScenario string
}

func (f *fakeModuleSource) GetScenario(_ context.Context, id string) (models.Scenario, error) {
	f.gotScenario = id
	return f.scenario, f.scenarioErr
}

func (f *fakeModuleSource) ListModules(_ context.Context, draftID string, _ mwanachamaagency.ModuleFilter) ([]models.Module, error) {
	f.listedDraft = draftID
	return f.modules, f.listErr
}

func codesOf(touched []TouchedModule) []string {
	codes := []string{}
	for _, t := range touched {
		codes = append(codes, t.Code)
	}
	return codes
}

func TestModulesTouchedRefusesAnUnknownScenarioAndNamesTheCaller(t *testing.T) {
	boom := errors.New("scenario gone")
	src := &fakeModuleSource{scenarioErr: boom}
	_, err := ModulesTouched(context.Background(), src, "sc-1")
	if !errors.Is(err, boom) {
		t.Fatalf("err = %v, want it to wrap %v", err, boom)
	}
	if err.Error() != "ModulesTouched: scenario gone" {
		t.Fatalf("err text = %q", err.Error())
	}
	if src.gotScenario != "sc-1" {
		t.Fatalf("asked for scenario %q", src.gotScenario)
	}
}

func TestModulesTouchedReportsAFailedModuleListing(t *testing.T) {
	boom := errors.New("listing failed")
	src := &fakeModuleSource{listErr: boom}
	_, err := ModulesTouched(context.Background(), src, "sc-1")
	if !errors.Is(err, boom) {
		t.Fatalf("err = %v, want it to wrap %v", err, boom)
	}
}

func TestModulesTouchedReadsTheScenariosOwnDraft(t *testing.T) {
	src := &fakeModuleSource{scenario: models.Scenario{DraftID: "draft-7"}}
	got, err := ModulesTouched(context.Background(), src, "sc-1")
	if err != nil {
		t.Fatal(err)
	}
	if src.listedDraft != "draft-7" {
		t.Fatalf("modules listed from draft %q, want draft-7", src.listedDraft)
	}
	if got == nil || len(got) != 0 {
		t.Fatalf("got %v, want an empty non-nil list", got)
	}
}

func TestModulesTouchedKeepsOnlyWhatTheScenarioCanReach(t *testing.T) {
	src := &fakeModuleSource{modules: []models.Module{
		{ID: "m-voting", Code: moduleVoting, Enabled: true, Explicit: true},
		{ID: "m-engage-off", Code: moduleEngage, Enabled: false, Explicit: true},
		{ID: "m-market-implicit", Code: moduleMarket, Enabled: true, Explicit: false},
		{ID: "m-custody-deleted", Code: moduleCustody, Enabled: true, Explicit: true, Deleted: true},
		{ID: "m-auth-locked", Code: "auth", Enabled: true, Explicit: true, Locked: true},
		{ID: "m-actor-default-on", Code: moduleActor, Enabled: true, Explicit: true},
		{ID: "m-unknown", Code: "nonesuch", Enabled: true, Explicit: true},
		{ID: "m-forms", Code: moduleForms, Enabled: true},
		{ID: "m-comm", Code: moduleComm, Enabled: true},
	}}
	got, err := ModulesTouched(context.Background(), src, "sc-1")
	if err != nil {
		t.Fatal(err)
	}
	want := []string{moduleComm, moduleForms, moduleVoting}
	if !reflect.DeepEqual(codesOf(got), want) {
		t.Fatalf("touched = %v, want %v", codesOf(got), want)
	}
}

func TestModulesTouchedDropsFormsAndCommWhenSwitchedOff(t *testing.T) {
	src := &fakeModuleSource{modules: []models.Module{
		{ID: "m-forms", Code: moduleForms, Enabled: false},
		{ID: "m-comm", Code: moduleComm, Enabled: false, Explicit: true},
	}}
	got, err := ModulesTouched(context.Background(), src, "sc-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("touched = %v, want none", codesOf(got))
	}
}

func TestModulesTouchedListsInCodeOrderWhateverTheStoredOrder(t *testing.T) {
	src := &fakeModuleSource{modules: []models.Module{
		{ID: "z", Code: moduleVoting, Enabled: true, Explicit: true},
		{ID: "a", Code: moduleEngage, Enabled: true, Explicit: true},
		{ID: "m", Code: moduleMarket, Enabled: true, Explicit: true},
	}}
	got, err := ModulesTouched(context.Background(), src, "sc-1")
	if err != nil {
		t.Fatal(err)
	}
	want := []string{moduleEngage, moduleMarket, moduleVoting}
	if !reflect.DeepEqual(codesOf(got), want) {
		t.Fatalf("touched = %v, want %v", codesOf(got), want)
	}
	if got[0].ModuleID != "a" || got[2].ModuleID != "z" {
		t.Fatalf("module ids = %q..%q, want a..z", got[0].ModuleID, got[2].ModuleID)
	}
}

func TestModulesTouchedReportsStoredMountsOverTheCatalogDefault(t *testing.T) {
	stored := `[{"name":"Elections","key":"elections"},{"name":"Surveys","key":"surveys"}]`
	src := &fakeModuleSource{modules: []models.Module{
		{ID: "m-voting", Code: moduleVoting, Enabled: true, Explicit: true, Mounts: stored},
		{ID: "m-market", Code: moduleMarket, Enabled: true, Explicit: true},
		{ID: "m-engage-broken", Code: moduleEngage, Enabled: true, Explicit: true, Mounts: "{not json"},
	}}
	got, err := ModulesTouched(context.Background(), src, "sc-1")
	if err != nil {
		t.Fatal(err)
	}
	byCode := map[string][]string{}
	for _, t := range got {
		byCode[t.Code] = t.Mounts
	}
	if !reflect.DeepEqual(byCode[moduleVoting], []string{"elections", "surveys"}) {
		t.Fatalf("voting mounts = %v", byCode[moduleVoting])
	}
	if !reflect.DeepEqual(byCode[moduleMarket], []string{"market"}) {
		t.Fatalf("market mounts = %v, want the catalog default", byCode[moduleMarket])
	}
	if !reflect.DeepEqual(byCode[moduleEngage], []string{"main"}) {
		t.Fatalf("engage mounts = %v, want the default when the stored text is unreadable", byCode[moduleEngage])
	}
}

func draftOf(id, created string, status models.DraftStatus, deleted bool) models.Draft {
	return models.Draft{ID: id, CreatedAt: created, Status: status, Deleted: deleted}
}

func TestWorkingDraftIsNoneWhenNothingIsOpen(t *testing.T) {
	if _, found := WorkingDraft(nil); found {
		t.Fatal("found a draft among none")
	}
	drafts := []models.Draft{
		draftOf("a", "2026-01-01T00:00:00Z", models.DraftStatusArchived, false),
		draftOf("b", "2026-02-01T00:00:00Z", models.DraftStatusOpen, true),
	}
	if d, found := WorkingDraft(drafts); found || d.ID != "" {
		t.Fatalf("got %+v found=%v, want the zero draft", d, found)
	}
}

func TestWorkingDraftIsTheNewestOpenOneWhateverTheOrder(t *testing.T) {
	older := draftOf("old", "2026-01-01T00:00:00Z", models.DraftStatusOpen, false)
	newer := draftOf("new", "2026-03-01T00:00:00Z", models.DraftStatusOpen, false)
	newestButArchived := draftOf("arch", "2026-05-01T00:00:00Z", models.DraftStatusArchived, false)
	newestButDeleted := draftOf("del", "2026-06-01T00:00:00Z", models.DraftStatusOpen, true)
	for _, drafts := range [][]models.Draft{
		{older, newer, newestButArchived, newestButDeleted},
		{newestButDeleted, newestButArchived, newer, older},
	} {
		got, found := WorkingDraft(drafts)
		if !found || got.ID != "new" {
			t.Fatalf("got %q found=%v, want new", got.ID, found)
		}
	}
}

func TestWorkingDraftBreaksATieOnCreationTimeByTheLargerID(t *testing.T) {
	a := draftOf("draft-a", "2026-01-01T00:00:00Z", models.DraftStatusOpen, false)
	b := draftOf("draft-b", "2026-01-01T00:00:00Z", models.DraftStatusOpen, false)
	for _, drafts := range [][]models.Draft{{a, b}, {b, a}} {
		got, found := WorkingDraft(drafts)
		if !found || got.ID != "draft-b" {
			t.Fatalf("got %q found=%v, want draft-b", got.ID, found)
		}
	}
}

type fakeAIManager struct {
	ai.Manager
	account ai.Account
	err     error
	askedID string
}

func (f *fakeAIManager) GetDefaultAccount(_ context.Context, agencyID string) (ai.Account, error) {
	f.askedID = agencyID
	return f.account, f.err
}

func intPtr(n int) *int { return &n }

func tokensFrom(t *testing.T, m *fakeAIManager) (int, error) {
	t.Helper()
	resolve := func(_ context.Context, _ string) (ai.Manager, error) { return m, nil }
	return TokensPerTestFrom(resolve)(context.Background(), "inst-1")
}

func TestTokensPerTestIsZeroWithoutAResolver(t *testing.T) {
	n, err := TokensPerTestFrom(nil)(context.Background(), "inst-1")
	if n != 0 || err != nil {
		t.Fatalf("got %d, %v", n, err)
	}
}

func TestTokensPerTestReturnsAPositiveLimitAndAsksForTheInstance(t *testing.T) {
	m := &fakeAIManager{account: ai.Account{TokensPerTest: intPtr(5000)}}
	n, err := tokensFrom(t, m)
	if err != nil || n != 5000 {
		t.Fatalf("got %d, %v, want 5000", n, err)
	}
	if m.askedID != "inst-1" {
		t.Fatalf("asked for account of %q", m.askedID)
	}
}

func TestTokensPerTestTreatsAnUnsetZeroOrNegativeLimitAsNoLimit(t *testing.T) {
	for name, limit := range map[string]*int{"unset": nil, "zero": intPtr(0), "negative": intPtr(-4)} {
		m := &fakeAIManager{account: ai.Account{TokensPerTest: limit}}
		n, err := tokensFrom(t, m)
		if n != 0 || err != nil {
			t.Fatalf("%s: got %d, %v, want 0 and no error", name, n, err)
		}
	}
}

func TestTokensPerTestPassesOnAResolverOrAccountFailure(t *testing.T) {
	boom := errors.New("no account")
	n, err := tokensFrom(t, &fakeAIManager{err: boom})
	if n != 0 || !errors.Is(err, boom) {
		t.Fatalf("account failure: got %d, %v", n, err)
	}
	resolveFails := func(_ context.Context, _ string) (ai.Manager, error) { return nil, boom }
	n, err = TokensPerTestFrom(resolveFails)(context.Background(), "inst-1")
	if n != 0 || !errors.Is(err, boom) {
		t.Fatalf("resolver failure: got %d, %v", n, err)
	}
}

func TestTokenLimitCountsAFailedLookupAsNoLimit(t *testing.T) {
	failing := &registry{tokensPerTest: func(context.Context, string) (int, error) { return 9, errors.New("down") }}
	if got := failing.tokenLimit("inst-1")(context.Background()); got != 0 {
		t.Fatalf("limit = %d, want 0 when the lookup fails", got)
	}
	working := &registry{tokensPerTest: func(_ context.Context, id string) (int, error) {
		if id != "inst-2" {
			return 1, nil
		}
		return 1200, nil
	}}
	if got := working.tokenLimit("inst-2")(context.Background()); got != 1200 {
		t.Fatalf("limit = %d, want 1200", got)
	}
}
