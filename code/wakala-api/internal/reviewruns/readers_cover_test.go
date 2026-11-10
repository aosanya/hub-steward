package reviewruns

import (
	"context"
	"errors"
	"strings"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
)

type fakeAgency struct {
	mwanachamaagency.AgencyManager
	agency     models.Agency
	agencyErr  error
	goals      []models.Goal
	goalsErr   error
	objectives []models.Objective
	objErr     error
	rules      []models.Rule
	rulesErr   error
	scenarios  []models.Scenario
	scenErr    error
}

func (f fakeAgency) GetAgency(context.Context) (models.Agency, error) { return f.agency, f.agencyErr }

func (f fakeAgency) ListGoals(context.Context, string, mwanachamaagency.GoalFilter) ([]models.Goal, error) {
	return f.goals, f.goalsErr
}

func (f fakeAgency) ListObjectives(context.Context, string, mwanachamaagency.ObjectiveFilter) ([]models.Objective, error) {
	return f.objectives, f.objErr
}

func (f fakeAgency) ListRules(context.Context, string, mwanachamaagency.RuleFilter) ([]models.Rule, error) {
	return f.rules, f.rulesErr
}

func (f fakeAgency) ListScenarios(context.Context, string, mwanachamaagency.ScenarioFilter) ([]models.Scenario, error) {
	return f.scenarios, f.scenErr
}

func read(t *testing.T, r DraftReader) string {
	t.Helper()
	text, err := r.Read(context.Background(), "d1")
	if err != nil {
		t.Fatal(err)
	}
	return text
}

func TestProfileReaderShowsNameAndDescriptionOrSaysThereIsNone(t *testing.T) {
	full := NewProfileReader(NewProfileManagerSource(fakeAgency{agency: models.Agency{Name: "Co-op", Description: "Sells maize"}}))
	if got := read(t, full); got != "Name: Co-op\nDescription: Sells maize\n" {
		t.Errorf("got %q", got)
	}
	half := NewProfileReader(NewProfileManagerSource(fakeAgency{agency: models.Agency{Name: "Co-op", Description: "  "}}))
	if got := read(t, half); got != "Name: Co-op\nDescription: (none)\n" {
		t.Errorf("got %q", got)
	}
	empty := NewProfileReader(NewProfileManagerSource(fakeAgency{}))
	if got := read(t, empty); got != profileNoneSentence {
		t.Errorf("got %q", got)
	}
}

func TestProfileReaderSaysItCouldNotReadAndKeepsTheCause(t *testing.T) {
	boom := errors.New("db down")
	_, err := NewProfileReader(NewProfileManagerSource(fakeAgency{agencyErr: boom})).Read(context.Background(), "d1")
	if !errors.Is(err, boom) || !strings.Contains(err.Error(), "The profile of this agency could not be read") {
		t.Errorf("err = %v", err)
	}
}

func TestGoalsReaderListsEachGoalWithTheIdsTheFixNeeds(t *testing.T) {
	goals := []models.Goal{
		{ID: "g1", Code: "G-1", Title: "Renew", Description: "Owned by the Secretary", Ordinality: 1},
		{ID: "g2", Code: "G-2", Title: "Grow", Description: " ", Ordinality: 2},
	}
	got := read(t, NewGoalsReader(NewGoalsManagerSource(fakeAgency{goals: goals})))
	for _, want := range []string{
		"Goal G-1 (goal_id: g1, ordinality: 1)\nTitle: Renew\nDescription: Owned by the Secretary\n",
		"Goal G-2 (goal_id: g2, ordinality: 2)\nTitle: Grow\nDescription: (none)\n",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in %q", want, got)
		}
	}
}

func TestGoalsReaderSaysWhenThereAreNoneAndWhenReadingFails(t *testing.T) {
	if got := read(t, NewGoalsReader(NewGoalsManagerSource(fakeAgency{}))); got != goalsNoneSentence {
		t.Errorf("got %q", got)
	}
	boom := errors.New("db down")
	_, err := NewGoalsReader(NewGoalsManagerSource(fakeAgency{goalsErr: boom})).Read(context.Background(), "d1")
	if !errors.Is(err, boom) || !strings.Contains(err.Error(), "The goals of this draft could not be read") {
		t.Errorf("err = %v", err)
	}
}

func TestObjectivesReaderGroupsObjectivesUnderTheirGoalAndShowsStrays(t *testing.T) {
	agency := fakeAgency{
		goals: []models.Goal{
			{ID: "g1", Code: "G-1", Title: "Renew", Description: "Keep members", Ordinality: 1},
			{ID: "g2", Code: "G-2", Title: "Grow", Ordinality: 2},
		},
		objectives: []models.Objective{
			{ID: "o1", Code: "O-1", GoalID: "g1", Title: "Call lapsed", Description: "By phone", Ordinality: 1},
			{ID: "o2", Code: "O-2", GoalID: "gone", Title: "Orphan", Ordinality: 1},
		},
	}
	got := read(t, NewObjectivesReader(agency))
	for _, want := range []string{
		"Draft id: d1",
		"Goal G-1 (id g1, position 1): Renew\n  description: Keep members\n  Objectives:\n  - Objective O-1 (id o1, goal_id g1, position 1): Call lapsed\n    description: By phone\n",
		"Goal G-2 (id g2, position 2): Grow\n  Objectives: none\n",
		"Objectives under no goal of this draft:\n  - Objective O-2 (id o2, goal_id gone, position 1): Orphan\n",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in\n%s", want, got)
		}
	}
}

func TestObjectivesReaderSaysWhenThereAreNoGoalsAndPassesErrorsOn(t *testing.T) {
	if got := read(t, NewObjectivesReader(fakeAgency{})); !strings.Contains(got, "This draft has no goals yet.") || strings.Contains(got, "under no goal") {
		t.Errorf("got %q", got)
	}
	boom := errors.New("down")
	if _, err := NewObjectivesReader(fakeAgency{goalsErr: boom}).Read(context.Background(), "d1"); !errors.Is(err, boom) {
		t.Errorf("goals err = %v", err)
	}
	if _, err := NewObjectivesReader(fakeAgency{objErr: boom}).Read(context.Background(), "d1"); !errors.Is(err, boom) {
		t.Errorf("objectives err = %v", err)
	}
}

func TestTestsSourceSkipsDeletedRulesAndNonRoleActors(t *testing.T) {
	agency := fakeAgency{
		rules: []models.Rule{{Code: "RU-1", Text: "One"}, {Code: "RU-2", Text: "Gone", Deleted: true}},
		scenarios: []models.Scenario{{
			ID: "s1", Name: "Join", Summary: "Joins", WorkflowID: "w1", Workflow: "Onboarding", Result: models.ScenarioPassed, Rules: []string{"RU-1"},
			Actors: []models.ScenarioActor{
				{Name: "Amina", Kind: models.ActorKindRole, RoleID: "r1", RoleName: "Member"},
				{Name: "System", Kind: models.ActorKindSystem},
				{Name: "Bot", Kind: models.ActorKindRole, BuiltIn: true},
				{Name: "Agent", Kind: models.ActorKindAgent},
			},
			Blocks: []models.ScenarioBlock{{StepID: "st1", Code: "B-1", Title: "Fill", Actor: "Amina", Then: "sent"}},
		}},
	}
	rules, scenarios, err := NewTestsAgencySource(agency).TestsOf(context.Background(), "d1")
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 || rules[0].Code != "RU-1" {
		t.Errorf("rules = %+v", rules)
	}
	if len(scenarios) != 1 || scenarios[0].Result != "Passed" || len(scenarios[0].Actors) != 1 || scenarios[0].Actors[0].Name != "Amina" || len(scenarios[0].Blocks) != 1 {
		t.Errorf("scenarios = %+v", scenarios)
	}
}

func TestTestsSourcePassesBothListErrorsOn(t *testing.T) {
	boom := errors.New("down")
	if _, _, err := NewTestsAgencySource(fakeAgency{rulesErr: boom}).TestsOf(context.Background(), "d"); !errors.Is(err, boom) {
		t.Errorf("rules err = %v", err)
	}
	if _, _, err := NewTestsAgencySource(fakeAgency{scenErr: boom}).TestsOf(context.Background(), "d"); !errors.Is(err, boom) {
		t.Errorf("scenarios err = %v", err)
	}
}

type fixedTests struct {
	rules     []TestsRule
	scenarios []TestsScenario
	err       error
}

func (f fixedTests) TestsOf(context.Context, string) ([]TestsRule, []TestsScenario, error) {
	return f.rules, f.scenarios, f.err
}

func TestTestsTextListsScenariosAndWhichRulesNoScenarioExercises(t *testing.T) {
	rules := []TestsRule{{Code: "RU-1", Text: "One"}, {Code: "RU-2", Text: "Two"}}
	scenarios := []TestsScenario{
		{ID: "s1", Name: "Join", Workflow: "Onboarding", WorkflowID: "w1", Result: "Passed", Rules: []string{"RU-1"},
			Actors: []TestsActor{{Name: "Amina", RoleID: "r1", RoleName: "Member"}},
			Blocks: []TestsBlock{{StepID: "st1", Code: "B-1", Title: "Fill", Actor: "Amina", Then: "sent"}}},
		{ID: "s2", Name: "Bare"},
	}
	got := TestsText(rules, scenarios)
	for _, want := range []string{
		"Rules of the agency (2):\n- RU-1: One\n- RU-2: Two",
		"Scenarios in Test (2):",
		"- scenario_id s1: Join",
		"latest result: Passed",
		"rules it exercises: RU-1",
		"Amina, role Member (role_id r1)",
		"B-1 Fill (step_id st1), played by Amina; pass condition (Then): sent",
		"tries: none",
		"people it plays: none",
		"script: no blocks",
		"Rules no scenario exercises: RU-2",
	} {
		if !strings.Contains(got, want) {
			t.Errorf("missing %q in\n%s", want, got)
		}
	}
}

func TestTestsTextNamesNoUncoveredRulesWhenEveryRuleIsExercised(t *testing.T) {
	got := TestsText([]TestsRule{{Code: "RU-1"}}, []TestsScenario{{ID: "s", Rules: []string{"RU-1"}}})
	if !strings.HasSuffix(got, "Rules no scenario exercises: none") {
		t.Errorf("got %q", got)
	}
	if got := TestsText(nil, nil); got != "The agency has no rules and no scenarios yet." {
		t.Errorf("empty = %q", got)
	}
}

func TestTestsReaderWrapsAFailureAsOneSentence(t *testing.T) {
	_, err := NewTestsReader(fixedTests{err: errors.New("db down.")}).Read(context.Background(), "d")
	if err == nil || err.Error() != "The rules and scenarios of the draft could not be read: db down." {
		t.Errorf("err = %v", err)
	}
	text := read(t, NewTestsReader(fixedTests{rules: []TestsRule{{Code: "RU-1", Text: "One"}}}))
	if !strings.Contains(text, "RU-1: One") {
		t.Errorf("text = %q", text)
	}
}

func TestDraftReaderFuncReadsThroughTheFunction(t *testing.T) {
	var r DraftReader = DraftReaderFunc(func(_ context.Context, id string) (string, error) { return "draft " + id, nil })
	if got := read(t, r); got != "draft d1" {
		t.Errorf("got %q", got)
	}
}
