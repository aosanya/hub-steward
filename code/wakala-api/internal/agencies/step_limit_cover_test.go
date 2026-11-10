package agencies

import (
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

func limitDocument() agencymodels.AgencyDocument {
	return agencymodels.AgencyDocument{
		Workflows: []agencymodels.DocumentWorkflow{
			{ID: "w-order", Code: "order"},
			{ID: "w-cancel", Code: "cancel_order"},
			{ID: "w-other", Code: "other"},
		},
		WorkItems: []agencymodels.DocumentWorkItem{
			{Code: "pack", WorkflowID: "w-order", TimeLimitMinutes: 90, CancelWorkflowID: "w-cancel"},
			{Code: "ship", WorkflowID: "w-order", TimeLimitMinutes: 0},
			{Code: "pack", WorkflowID: "w-other", TimeLimitMinutes: 5},
		},
	}
}

func TestLimitOfStepReadsTheMinutesAndTheCancelWorkflowCode(t *testing.T) {
	limit, found := limitOfStep(limitDocument(), "order", "pack")
	if !found || limit.minutes != 90 || limit.cancelCode != "cancel_order" {
		t.Fatalf("got %+v found=%v", limit, found)
	}
}

func TestLimitOfStepIsFoundWithNoLimitWhenTheStepHasNoMinutes(t *testing.T) {
	limit, found := limitOfStep(limitDocument(), "order", "ship")
	if !found || limit.minutes != 0 || limit.cancelCode != "" {
		t.Fatalf("a step without minutes must be found and unlimited, got %+v found=%v", limit, found)
	}
}

func TestLimitOfStepSeparatesTheSameStepCodeOfAnotherWorkflow(t *testing.T) {
	limit, found := limitOfStep(limitDocument(), "other", "pack")
	if !found || limit.minutes != 5 || limit.cancelCode != "" {
		t.Fatalf("got %+v found=%v", limit, found)
	}
}

func TestLimitOfStepIsNotFoundForAStepTheWorkflowDoesNotHave(t *testing.T) {
	if _, found := limitOfStep(limitDocument(), "order", "deliver"); found {
		t.Fatal("an unknown step must not be found")
	}
	if _, found := limitOfStep(limitDocument(), "missing", "pack"); found {
		t.Fatal("an unknown workflow must not be found")
	}
}
