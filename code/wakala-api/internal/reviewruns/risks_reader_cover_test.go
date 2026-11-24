package reviewruns

import (
	"context"
	"errors"
	"strings"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type fakeRisksAgency struct {
	risks    []agencymodels.Risk
	pathways []agencymodels.RiskPathway
	rules    []agencymodels.Rule
	err      error
}

func (f fakeRisksAgency) ListRisks(context.Context, string, mwanachamaagency.RiskFilter) ([]agencymodels.Risk, error) {
	return f.risks, f.err
}

func (f fakeRisksAgency) ListRiskPathways(context.Context, string, mwanachamaagency.RiskPathwayFilter) ([]agencymodels.RiskPathway, error) {
	return f.pathways, nil
}

func (f fakeRisksAgency) ListRules(context.Context, string, mwanachamaagency.RuleFilter) ([]agencymodels.Rule, error) {
	return f.rules, nil
}

type fakeRisksControls struct {
	controls    []agencymodels.Control
	attachments map[string][]agencymodels.ControlAttachment
	roles       []agencymodels.Role
}

func (f fakeRisksControls) ListControls(context.Context, string, mwanachamaagency.ControlFilter) ([]agencymodels.Control, error) {
	return f.controls, nil
}

func (f fakeRisksControls) ListControlAttachments(_ context.Context, id string) ([]agencymodels.ControlAttachment, error) {
	return f.attachments[id], nil
}

func (f fakeRisksControls) ListRoles(context.Context, string, mwanachamaagency.RoleFilter) ([]agencymodels.Role, error) {
	return f.roles, nil
}

type fakeRisksSource struct {
	snapshot RisksSnapshot
	err      error
}

func (f fakeRisksSource) ListRisks(context.Context, string) (RisksSnapshot, error) {
	return f.snapshot, f.err
}

func TestRisksText_EmptySnapshotSaysEverythingIsNone(t *testing.T) {
	got := RisksText(RisksSnapshot{})
	for _, want := range []string{
		"No risks are recorded for this draft.",
		"Rules of the agency:\n  none\n",
		"Controls of the agency:\n  none\n",
		"Roles holding controls.edit: none",
		"Roles holding controls.approve: none",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in:\n%s", want, got)
		}
	}
	if strings.Contains(got, "Hazards of the agency") || strings.Contains(got, "Library parts") || strings.Contains(got, "name no hazard") {
		t.Errorf("empty sections must be omitted:\n%s", got)
	}
}

func TestRisksText_EntryShowsFallbacksForBlankFieldsAndOptionalLines(t *testing.T) {
	got := RisksText(RisksSnapshot{Risks: []RisksEntry{
		{ID: "r1", Title: "Data leak", TopEvent: "  "},
		{ID: "r2", Code: "RK-2", Title: "Fire", TopEvent: "Blaze", Hazard: "Heat", HazardCode: "HZ-1", Owner: "Ops",
			Threats:      []RisksPathway{{ID: "t1", Title: "Spark", Scenario: "a short", HazardCode: "HZ-1"}},
			Consequences: []RisksPathway{{ID: "c1", Code: "C-1", Title: "Loss"}}},
	}})
	if !strings.Contains(got, "Risks: 2\n") {
		t.Errorf("count line missing:\n%s", got)
	}
	first := got[strings.Index(got, "Risk id r1"):strings.Index(got, "Risk id r2")]
	for _, want := range []string{"Risk id r1 (no code): Data leak", "top event: none", "hazard: none", "owner: none", "threats: none", "consequences: none"} {
		if !strings.Contains(first, want) {
			t.Errorf("first risk missing %q:\n%s", want, first)
		}
	}
	if strings.Contains(first, "hazard code:") {
		t.Errorf("blank hazard code must not print:\n%s", first)
	}
	second := got[strings.Index(got, "Risk id r2"):]
	for _, want := range []string{"Risk id r2 (RK-2): Fire", "hazard code: HZ-1", "owner: Ops", "threat id t1 (no code): Spark", "example: a short", "consequence id c1 (C-1): Loss"} {
		if !strings.Contains(second, want) {
			t.Errorf("second risk missing %q:\n%s", want, second)
		}
	}
}

func TestRisksText_ControlsShowAttachmentsAndFallbacks(t *testing.T) {
	got := RisksText(RisksSnapshot{
		Hazards:    []RisksHazard{{Code: "HZ-1", Title: "Heat", Consequences: 2}},
		Hazardless: []RisksHazardless{{ID: "c9", Code: "C-9", Title: "Orphan"}},
		Rules:      []RisksRule{{Code: "RU-1", Text: "Never alone"}},
		Controls: []RisksControl{
			{Code: "CT-1", Text: "Lock", Attachments: []RisksAttachment{{TargetType: "threat", TargetCode: "T-1"}, {TargetType: "consequence", TargetCode: "C-1"}}},
			{Code: "CT-2", Text: "Alarm", Action: "ring", Condition: "temp > 5", OnBreach: "block", Severity: "high", Strength: "strong"},
		},
		ControlEditors:   []string{"R-1 Lead", "R-2 Aide"},
		ControlApprovers: []string{"R-3 Chief"},
		LibraryUses:      []RisksLibraryUse{{Kind: "threat", Code: "T-1", Title: "Spark", Uses: 3}},
	})
	for _, want := range []string{
		"  - HZ-1 (Heat): 2 consequences",
		"  - id c9, C-9: Orphan\n    description: none",
		"  - RU-1: Never alone",
		"  - CT-1: Lock\n    action: none\n    condition: none\n    on breach: none\n    severity: none\n    strength: unknown\n    attached to: threat T-1\n    attached to: consequence C-1",
		"  - CT-2: Alarm\n    action: ring\n    condition: temp > 5\n    on breach: block\n    severity: high\n    strength: strong\n    attached to: nothing",
		"Roles holding controls.edit: R-1 Lead, R-2 Aide",
		"Roles holding controls.approve: R-3 Chief",
		"Library parts and how many bowties use each:\n  - threat T-1 (Spark): used by 3",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in:\n%s", want, got)
		}
	}
}

func TestNewRisksReader_ReturnsTheTextAndPassesTheDraftID(t *testing.T) {
	var seen string
	src := risksSourceFunc(func(_ context.Context, draftID string) (RisksSnapshot, error) {
		seen = draftID
		return RisksSnapshot{Rules: []RisksRule{{Code: "RU-1", Text: "x"}}}, nil
	})
	text, err := NewRisksReader(src).Read(context.Background(), "d7")
	if err != nil || seen != "d7" || !strings.Contains(text, "RU-1: x") {
		t.Fatalf("text=%q seen=%q err=%v", text, seen, err)
	}
}

type risksSourceFunc func(ctx context.Context, draftID string) (RisksSnapshot, error)

func (f risksSourceFunc) ListRisks(ctx context.Context, draftID string) (RisksSnapshot, error) {
	return f(ctx, draftID)
}

func TestNewRisksReader_SourceFailureIsReturnedWithNoText(t *testing.T) {
	boom := errors.New("down")
	text, err := NewRisksReader(fakeRisksSource{err: boom}).Read(context.Background(), "d")
	if !errors.Is(err, boom) || text != "" {
		t.Fatalf("text=%q err=%v", text, err)
	}
}

func TestRisksReadFailure_NamesTheDraftReadAndDropsOneTrailingDot(t *testing.T) {
	if got := risksReadFailure(errors.New("timeout.")).Error(); got != "The risks of this draft could not be read: timeout." {
		t.Errorf("got %q", got)
	}
	if got := risksReadFailure(errors.New("timeout")).Error(); got != "The risks of this draft could not be read: timeout." {
		t.Errorf("got %q", got)
	}
}

func TestRisksAgencySource_SplitsPathwaysByRiskAndSide(t *testing.T) {
	agency := fakeRisksAgency{
		risks: []agencymodels.Risk{{ID: "r1", Code: "RK-1", Title: "Fire", Owner: "Ops"}, {ID: "r2", Code: "RK-2", Title: "Flood"}},
		pathways: []agencymodels.RiskPathway{
			{ID: "p1", RiskID: "r1", Side: agencymodels.RiskSideThreat, Title: "Spark"},
			{ID: "p2", RiskID: "r1", Side: agencymodels.RiskSideConsequence, Title: "Loss"},
			{ID: "p3", RiskID: "r2", Side: agencymodels.RiskSideThreat, Title: "Rain"},
			{ID: "p4", RiskID: "gone", Side: agencymodels.RiskSideThreat, Title: "Stray"},
		},
		rules: []agencymodels.Rule{{Code: "RU-1", Text: "Be safe"}},
	}
	snap, err := NewRisksAgencySource(agency).ListRisks(context.Background(), "d")
	if err != nil {
		t.Fatal(err)
	}
	if len(snap.Risks) != 2 || len(snap.Risks[0].Threats) != 1 || snap.Risks[0].Threats[0].Title != "Spark" ||
		len(snap.Risks[0].Consequences) != 1 || snap.Risks[0].Consequences[0].Title != "Loss" ||
		len(snap.Risks[1].Threats) != 1 || len(snap.Risks[1].Consequences) != 0 {
		t.Fatalf("risks=%+v", snap.Risks)
	}
	if len(snap.Rules) != 1 || snap.Rules[0] != (RisksRule{Code: "RU-1", Text: "Be safe"}) {
		t.Errorf("rules=%+v", snap.Rules)
	}
	if len(snap.Controls) != 0 || len(snap.Hazards) != 0 {
		t.Errorf("a plain agency reads no controls or library: %+v", snap)
	}
}

func TestRisksAgencySource_ListFailureReturnsAnEmptySnapshot(t *testing.T) {
	boom := errors.New("db")
	snap, err := NewRisksAgencySource(fakeRisksAgency{err: boom}).ListRisks(context.Background(), "d")
	if !errors.Is(err, boom) || len(snap.Risks) != 0 {
		t.Fatalf("snap=%+v err=%v", snap, err)
	}
}

func TestRisksControlsSource_ReadsControlsConditionAttachmentsAndPermissionHolders(t *testing.T) {
	controls := fakeRisksControls{
		controls: []agencymodels.Control{
			{ID: "k1", Code: "CT-1", Text: "Lock", CondField: "temp", CondOperator: "gt", CondValue: "5", OnBreach: "block", Severity: "high"},
			{ID: "k2", Code: "CT-2", Text: "Alarm", CondField: "", CondOperator: "gt", CondValue: "9"},
		},
		attachments: map[string][]agencymodels.ControlAttachment{"k1": {{TargetType: agencymodels.TargetTypeThreat, TargetCode: "T-1"}}},
		roles: []agencymodels.Role{
			{Code: "R-1", Name: "Lead", Permissions: []string{"controls.edit", "controls.approve"}},
			{Code: "R-2", Name: "Aide", Permissions: []string{"controls.edit", "other"}},
			{Code: "R-3", Name: "Guest"},
		},
	}
	strength := func(_ context.Context, _ string, c agencymodels.Control) (agencymodels.ControlStrength, error) {
		return agencymodels.ControlStrength("strong-" + c.Code), nil
	}
	snap, err := NewRisksControlsSource(fakeRisksAgency{}, controls, strength).ListRisks(context.Background(), "d")
	if err != nil {
		t.Fatal(err)
	}
	if len(snap.Controls) != 2 {
		t.Fatalf("controls=%+v", snap.Controls)
	}
	first, second := snap.Controls[0], snap.Controls[1]
	if first.Condition != "temp gt 5" || first.OnBreach != "block" || first.Severity != "high" || first.Strength != "strong-CT-1" ||
		len(first.Attachments) != 1 || first.Attachments[0] != (RisksAttachment{TargetType: "threat", TargetCode: "T-1"}) {
		t.Errorf("first=%+v", first)
	}
	if second.Condition != "" || len(second.Attachments) != 0 {
		t.Errorf("a control with no condition field has no condition: %+v", second)
	}
	if strings.Join(snap.ControlEditors, "|") != "R-1 Lead|R-2 Aide" || strings.Join(snap.ControlApprovers, "|") != "R-1 Lead" {
		t.Errorf("editors=%v approvers=%v", snap.ControlEditors, snap.ControlApprovers)
	}
}

func TestRisksControlsSource_StrengthFailureStopsTheRead(t *testing.T) {
	boom := errors.New("strength")
	controls := fakeRisksControls{controls: []agencymodels.Control{{ID: "k1", Code: "CT-1"}}}
	strength := func(context.Context, string, agencymodels.Control) (agencymodels.ControlStrength, error) {
		return "", boom
	}
	snap, err := NewRisksControlsSource(fakeRisksAgency{}, controls, strength).ListRisks(context.Background(), "d")
	if !errors.Is(err, boom) || len(snap.Controls) != 0 {
		t.Fatalf("snap=%+v err=%v", snap, err)
	}
}

func TestRisksControlsSource_NoStrengthFuncLeavesStrengthBlank(t *testing.T) {
	controls := fakeRisksControls{controls: []agencymodels.Control{{ID: "k1", Code: "CT-1"}}}
	snap, err := NewRisksControlsSource(fakeRisksAgency{}, controls, nil).ListRisks(context.Background(), "d")
	if err != nil || len(snap.Controls) != 1 || snap.Controls[0].Strength != "" {
		t.Fatalf("snap=%+v err=%v", snap, err)
	}
}

type fakeRisksLibraryAgency struct {
	fakeRisksAgency
	hazards      []agencymodels.Hazard
	consequences []agencymodels.Consequence
	links        []agencymodels.RiskConsequence
}

func (f fakeRisksLibraryAgency) ListHazards(context.Context, string, mwanachamaagency.LibraryPartFilter) ([]agencymodels.Hazard, error) {
	return f.hazards, nil
}

func (f fakeRisksLibraryAgency) ListConsequences(context.Context, string, mwanachamaagency.ConsequenceFilter) ([]agencymodels.Consequence, error) {
	return f.consequences, nil
}

func (f fakeRisksLibraryAgency) ListRiskConsequences(context.Context, string, mwanachamaagency.RiskConsequenceFilter) ([]agencymodels.RiskConsequence, error) {
	return f.links, nil
}

func TestRisksAgencySource_LibraryConsequencesReplaceStoredConsequencePathways(t *testing.T) {
	agency := fakeRisksLibraryAgency{
		fakeRisksAgency: fakeRisksAgency{
			risks: []agencymodels.Risk{{ID: "r1", Code: "RK-1", Title: "Fire"}},
			pathways: []agencymodels.RiskPathway{
				{ID: "p1", RiskID: "r1", Side: agencymodels.RiskSideThreat, Title: "Spark"},
				{ID: "p2", RiskID: "r1", Side: agencymodels.RiskSideConsequence, Title: "Stored loss"},
			},
		},
		hazards: []agencymodels.Hazard{{Code: "HZ-1", Title: "Heat"}, {Code: "HZ-2", Title: "Cold"}},
		consequences: []agencymodels.Consequence{
			{ID: "c1", Code: "C-1", HazardCode: "HZ-1", Title: "Burn", Description: "skin"},
			{ID: "c2", Code: "C-2", HazardCode: "HZ-1", Title: "Smoke"},
			{ID: "c3", Code: "C-3", Title: "Orphan", Description: "no hazard"},
		},
		links: []agencymodels.RiskConsequence{
			{RiskCode: "RK-1", ConsequenceCode: "C-1"},
			{RiskCode: "RK-1", ConsequenceCode: "C-404"},
		},
	}
	snap, err := NewRisksAgencySource(agency).ListRisks(context.Background(), "d")
	if err != nil {
		t.Fatal(err)
	}
	got := snap.Risks[0]
	if len(got.Threats) != 1 || len(got.Consequences) != 1 || got.Consequences[0] != (RisksPathway{ID: "c1", Code: "C-1", Title: "Burn", Scenario: "skin", HazardCode: "HZ-1"}) {
		t.Errorf("risk=%+v", got)
	}
	if len(snap.Hazards) != 2 || snap.Hazards[0] != (RisksHazard{Code: "HZ-1", Title: "Heat", Consequences: 2}) || snap.Hazards[1].Consequences != 0 {
		t.Errorf("hazards=%+v", snap.Hazards)
	}
	if len(snap.Hazardless) != 1 || snap.Hazardless[0].Code != "C-3" || snap.Hazardless[0].Description != "no hazard" {
		t.Errorf("hazardless=%+v", snap.Hazardless)
	}
}
