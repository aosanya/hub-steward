package agencies

import (
	"context"
	"errors"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

func mun327Document() agencymodels.AgencyDocument {
	return agencymodels.AgencyDocument{
		Workflows: []agencymodels.DocumentWorkflow{{ID: "w-round", Code: "round"}},
		WorkItems: []agencymodels.DocumentWorkItem{
			{ID: "s-collect", Code: "collect", WorkflowID: "w-round", Ordinality: 1},
			{ID: "s-send", Code: "send", WorkflowID: "w-round", Ordinality: 2},
			{ID: "s-route", Code: "route", WorkflowID: "w-round", Ordinality: 3, Kind: agencymodels.StepKindRoute, OtherwiseStepID: "s-consent", Routes: []agencymodels.StepRoute{
				{GoToStep: "s-paper"},
				{GoToStep: "s-phone"},
			}},
			{ID: "s-paper", Code: "paper", WorkflowID: "w-round", Ordinality: 4},
			{ID: "s-phone", Code: "phone", WorkflowID: "w-round", Ordinality: 5},
			{ID: "s-consent", Code: "consent", WorkflowID: "w-round", Ordinality: 6},
			{ID: "s-file", Code: "file", WorkflowID: "w-round", Ordinality: 7},
		},
	}
}

func TestMun327AStepAfterARouteMayBeAnyBranchTheRouteCanChoose(t *testing.T) {
	cases := map[string]struct {
		current, step string
		want          error
	}{
		"the first branch":                  {"route", "paper", nil},
		"the second branch":                 {"route", "phone", nil},
		"the otherwise branch":              {"route", "consent", nil},
		"a step past every branch":          {"route", "file", mwanachamataskmanager.ErrStepOutOfOrder},
		"a step before the route":           {"route", "send", mwanachamataskmanager.ErrStepOutOfOrder},
		"the step after the last branch":    {"consent", "file", nil},
		"the step after a middle branch":    {"phone", "file", nil},
		"the step after the first branch":   {"paper", "file", nil},
		"another branch after a branch":     {"paper", "phone", mwanachamataskmanager.ErrStepOutOfOrder},
		"the otherwise after a branch":      {"phone", "consent", mwanachamataskmanager.ErrStepOutOfOrder},
		"a branch skipped past the route":   {"send", "paper", mwanachamataskmanager.ErrStepOutOfOrder},
		"the route after its sent step":     {"send", "route", nil},
		"the same branch again":             {"phone", "phone", mwanachamataskmanager.ErrStepOutOfOrder},
		"the first step of a fresh run":     {"", "collect", nil},
		"a jump past the first step":        {"", "file", mwanachamataskmanager.ErrStepOutOfOrder},
		"the ordinary step after the plain": {"collect", "send", nil},
	}
	for name, c := range cases {
		board := newFakeBoard()
		board.run = mwanachamataskmanager.WorkflowRun{WorkflowCode: "round", WorkflowVersion: 2, CurrentStepID: c.current}
		lb := limitedOver(board, fixedPublications{document: mun327Document()}, nil)
		_, err := lb.BeginWorkflowRunStep(context.Background(), "run-1", c.step, 0, "")
		if !errors.Is(err, c.want) && !(c.want == nil && err == nil) {
			t.Errorf("%s: %s after %q gave %v", name, c.step, c.current, err)
		}
	}
}
