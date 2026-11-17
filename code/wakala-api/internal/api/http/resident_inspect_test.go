package http

import (
	"slices"
	"testing"
)

func TestResidentForms_AnInspectionOfASendIsNotAResidentAction(t *testing.T) {
	if slices.Contains(residentFormsActions, "forms.submission.inspect") {
		t.Errorf("residentFormsActions holds forms.submission.inspect: %v", residentFormsActions)
	}
	if residentMay(formsScope, "forms.submission.inspect") {
		t.Error("a resident may forms.submission.inspect")
	}
	if slices.Contains(everyResidentAction(), "forms.submission.inspect") {
		t.Error("the resident role is seeded with forms.submission.inspect")
	}
}
