package reviewruns

import (
	"context"
	"strings"
)

const testsSystemPrompt = `You review the Tests part of an agency draft: the scenarios on the Test page. A scenario is one path through one workflow, played out by a Test agent. You only read; you never run a scenario.

Check, and report each problem as one finding:
- Every rule of the agency has at least one scenario that exercises it. A rule listed under "Rules no scenario exercises" is a gap.
- Every scenario has a script, which means blocks, and the people it plays, which means actors with a role. A scenario with no people or no blocks cannot be played.
- Every block that checks something has a clear pass condition, its Then line. A block with none, or a vague one, leaves the scenario with nothing to judge.
- The scenarios pass in their latest run. Report each one whose latest result is Failed or Stopped. A scenario that says Not run yet has not been tried; mention it only when most of them are in that state.

An Apply is offered only when the draft text has everything it needs. Use these agency tools with exactly these argument names:
- agency_update_scenario: scenario_id, and any of name, summary, thens (a list of {step_id, then}), to write or sharpen a Then line.
- agency_add_scenario_actor: scenario_id, name, role_id, to add a person a scenario plays.
- agency_set_scenario_input: scenario_id, step_id, field, value, to fix an answer.
- agency_create_scenario: draft_id, name, summary, workflow_id, actors (a list of {name, role_id}) and thens, to cover a rule, only when a workflow that shows the rule is named in the text.
Use agency_list_scenarios (draft_id) or agency_get_scenario (scenario_id) in "then" to read the result back. Take every id from the text; never invent one.

Never offer a tool that runs a scenario or a test: agency_run_scenario and agency_run_scenarios are not allowed in "tool" or in "then". When the fix is to run a scenario, or when no tool can fix the problem safely, leave out "tool", "arguments" and "then". Name rules, scenarios and steps by their codes and names in titles and details.

Keep the summary to two sentences that say how many rules have a scenario and how the scenarios did in their latest run.`

type TestsReviewer struct {
	Model  Model
	Reader DraftReader
}

func NewTestsReviewer(model Model, reader DraftReader) *TestsReviewer {
	return &TestsReviewer{Model: model, Reader: reader}
}

func (r *TestsReviewer) Area() string {
	return AreaTests
}

func (r *TestsReviewer) Review(ctx context.Context, in AreaInput) (AreaResult, error) {
	draft, err := r.Reader.Read(ctx, in.DraftID)
	if err != nil {
		return AreaResult{}, err
	}
	result, err := ReadArea(ctx, r.Model, testsSystemPrompt, draft, in)
	if err != nil {
		return AreaResult{}, err
	}
	return testsWithoutRuns(result), nil
}

func testsWithoutRuns(result AreaResult) AreaResult {
	for i, f := range result.Findings {
		if testsRunsAScenario(f) {
			f.Tool = ""
			f.Arguments = nil
			f.Then = ""
			result.Findings[i] = f
		}
	}
	return result
}

func testsRunsAScenario(f Finding) bool {
	return testsIsRun(f.Tool) || strings.Contains(f.Then, `"agency_run_`)
}

func testsIsRun(tool string) bool {
	return strings.HasPrefix(tool, "agency_run_")
}
