package http

import (
	"slices"
	"testing"
)

func TestResidentForms_ADecisionOnASendIsNotAResidentAction(t *testing.T) {
	if slices.Contains(residentFormsActions, "forms.submission.decide") {
		t.Errorf("residentFormsActions holds forms.submission.decide: %v", residentFormsActions)
	}
	if residentMay(formsScope, "forms.submission.decide") {
		t.Error("a resident may forms.submission.decide")
	}
	if slices.Contains(everyResidentAction(), "forms.submission.decide") {
		t.Error("the resident role is seeded with forms.submission.decide")
	}
}
