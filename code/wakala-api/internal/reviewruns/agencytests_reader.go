package reviewruns

import (
	"context"
	"fmt"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

type TestsRule struct {
	Code string
	Text string
}

type TestsActor struct {
	Name     string
	RoleID   string
	RoleName string
}

type TestsBlock struct {
	StepID string
	Code   string
	Title  string
	Actor  string
	Then   string
}

type TestsScenario struct {
	ID         string
	Name       string
	Summary    string
	WorkflowID string
	Workflow   string
	Result     string
	Rules      []string
	Actors     []TestsActor
	Blocks     []TestsBlock
}

type TestsSource interface {
	TestsOf(ctx context.Context, draftID string) ([]TestsRule, []TestsScenario, error)
}

type TestsAgency interface {
	ListRules(ctx context.Context, draftID string, filter mwanachamaagency.RuleFilter) ([]agencymodels.Rule, error)
	ListScenarios(ctx context.Context, draftID string, filter mwanachamaagency.ScenarioFilter) ([]agencymodels.Scenario, error)
}

type testsAgencySource struct {
	agency TestsAgency
}

func NewTestsAgencySource(agency TestsAgency) TestsSource {
	return testsAgencySource{agency: agency}
}

func (s testsAgencySource) TestsOf(ctx context.Context, draftID string) ([]TestsRule, []TestsScenario, error) {
	rules, err := s.agency.ListRules(ctx, draftID, mwanachamaagency.RuleFilter{})
	if err != nil {
		return nil, nil, err
	}
	scenarios, err := s.agency.ListScenarios(ctx, draftID, mwanachamaagency.ScenarioFilter{})
	if err != nil {
		return nil, nil, err
	}
	outRules := make([]TestsRule, 0, len(rules))
	for _, r := range rules {
		if r.Deleted {
			continue
		}
		outRules = append(outRules, TestsRule{Code: r.Code, Text: r.Text})
	}
	outScenarios := make([]TestsScenario, 0, len(scenarios))
	for _, sc := range scenarios {
		outScenarios = append(outScenarios, testsScenarioOf(sc))
	}
	return outRules, outScenarios, nil
}

func testsScenarioOf(sc agencymodels.Scenario) TestsScenario {
	out := TestsScenario{
		ID:         sc.ID,
		Name:       sc.Name,
		Summary:    sc.Summary,
		WorkflowID: sc.WorkflowID,
		Workflow:   sc.Workflow,
		Result:     sc.Result.Label(),
		Rules:      sc.Rules,
	}
	for _, a := range sc.Actors {
		if a.BuiltIn || a.Kind != agencymodels.ActorKindRole {
			continue
		}
		out.Actors = append(out.Actors, TestsActor{Name: a.Name, RoleID: a.RoleID, RoleName: a.RoleName})
	}
	for _, b := range sc.Blocks {
		out.Blocks = append(out.Blocks, TestsBlock{StepID: b.StepID, Code: b.Code, Title: b.Title, Actor: b.Actor, Then: b.Then})
	}
	return out
}

func NewTestsReader(src TestsSource) DraftReader {
	return DraftReaderFunc(func(ctx context.Context, draftID string) (string, error) {
		rules, scenarios, err := src.TestsOf(ctx, draftID)
		if err != nil {
			return "", fmt.Errorf("The rules and scenarios of the draft could not be read: %s.", strings.TrimSuffix(err.Error(), "."))
		}
		return TestsText(rules, scenarios), nil
	})
}

func TestsText(rules []TestsRule, scenarios []TestsScenario) string {
	if len(rules) == 0 && len(scenarios) == 0 {
		return "The agency has no rules and no scenarios yet."
	}
	var b strings.Builder
	testsWriteRules(&b, rules)
	testsWriteScenarios(&b, scenarios)
	testsWriteUncovered(&b, rules, scenarios)
	return strings.TrimSpace(b.String())
}

func testsWriteRules(b *strings.Builder, rules []TestsRule) {
	fmt.Fprintf(b, "Rules of the agency (%d):\n", len(rules))
	for _, r := range rules {
		fmt.Fprintf(b, "- %s: %s\n", r.Code, r.Text)
	}
	b.WriteString("\n")
}

func testsWriteScenarios(b *strings.Builder, scenarios []TestsScenario) {
	fmt.Fprintf(b, "Scenarios in Test (%d):\n", len(scenarios))
	for _, s := range scenarios {
		fmt.Fprintf(b, "\n- scenario_id %s: %s\n", s.ID, s.Name)
		fmt.Fprintf(b, "  tries: %s\n", testsOrNone(s.Summary))
		fmt.Fprintf(b, "  workflow: %s (workflow_id %s)\n", testsOrNone(s.Workflow), s.WorkflowID)
		fmt.Fprintf(b, "  latest result: %s\n", testsOrNone(s.Result))
		fmt.Fprintf(b, "  rules it exercises: %s\n", testsOrNone(strings.Join(s.Rules, ", ")))
		testsWriteActors(b, s.Actors)
		testsWriteBlocks(b, s.Blocks)
	}
	b.WriteString("\n")
}

func testsWriteActors(b *strings.Builder, actors []TestsActor) {
	if len(actors) == 0 {
		b.WriteString("  people it plays: none\n")
		return
	}
	b.WriteString("  people it plays:\n")
	for _, a := range actors {
		fmt.Fprintf(b, "    %s, role %s (role_id %s)\n", a.Name, testsOrNone(a.RoleName), a.RoleID)
	}
}

func testsWriteBlocks(b *strings.Builder, blocks []TestsBlock) {
	if len(blocks) == 0 {
		b.WriteString("  script: no blocks\n")
		return
	}
	b.WriteString("  script, one block for each step:\n")
	for _, k := range blocks {
		fmt.Fprintf(b, "    %s %s (step_id %s), played by %s; pass condition (Then): %s\n", k.Code, k.Title, k.StepID, testsOrNone(k.Actor), testsOrNone(k.Then))
	}
}

func testsWriteUncovered(b *strings.Builder, rules []TestsRule, scenarios []TestsScenario) {
	covered := map[string]bool{}
	for _, s := range scenarios {
		for _, code := range s.Rules {
			covered[code] = true
		}
	}
	var missing []string
	for _, r := range rules {
		if !covered[r.Code] {
			missing = append(missing, r.Code)
		}
	}
	fmt.Fprintf(b, "Rules no scenario exercises: %s\n", testsOrNone(strings.Join(missing, ", ")))
}

func testsOrNone(s string) string {
	if strings.TrimSpace(s) == "" {
		return "none"
	}
	return s
}
