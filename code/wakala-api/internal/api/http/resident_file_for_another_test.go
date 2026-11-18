package http

import (
	"slices"
	"testing"
)

func TestResidentActions_FilingForAnotherPersonIsNotAResidentAction(t *testing.T) {
	filings := []string{"forms.submission.file", "catalog.raised_item.file", "actor.assignment.create"}
	for _, action := range filings {
		if slices.Contains(everyResidentAction(), action) {
			t.Errorf("the resident role is seeded with %s", action)
		}
		if slices.Contains(residentFormsActions, action) {
			t.Errorf("residentFormsActions holds %s", action)
		}
	}
}
