package mwanachamaagency

import (
	"errors"
	"strings"
	"testing"

	"wakalaserver/modules/agency/models"
)

func invalidFn(format string, args ...any) error { return errors.New(format) }

func TestValidateRowAnswer_TimeRangeReadsAsWordsWithToAfterFrom(t *testing.T) {
	q := models.StepQuestion{Prompt: "Between which hours", AnswerType: models.AnswerTimeRange}
	if err := validateRowAnswer(q, "from 09:00 to 17:00"); err != nil {
		t.Fatalf("a good range was refused: %v", err)
	}
	for _, bad := range []string{"nine to five", "from 17:00 to 09:00", "from 09:00 to 09:00"} {
		if err := validateRowAnswer(q, bad); err == nil {
			t.Errorf("%q was accepted", bad)
		}
	}
}

func TestValidateRowAnswer_AddressTakesTheWordsAsTyped(t *testing.T) {
	q := models.StepQuestion{Prompt: "Which street", AnswerType: models.AnswerAddress, AllowFreeText: true}
	if err := validateRowAnswer(q, "Fő tér 2"); err != nil {
		t.Fatalf("words were refused: %v", err)
	}
}

func TestValidateFormQuestion_AllowFreeTextOnlyOnAnAddressQuestion(t *testing.T) {
	ok := models.StepQuestion{Prompt: "Which street", AnswerType: models.AnswerAddress, AllowFreeText: true}
	if err := validateFormQuestion(func(f string, a ...any) error { return errors.New(f) }, 1, ok); err != nil {
		t.Fatalf("address with free text refused: %v", err)
	}
	bad := models.StepQuestion{Prompt: "How many", AnswerType: models.AnswerNumber, AllowFreeText: true}
	err := validateFormQuestion(func(f string, a ...any) error { return errors.New(f) }, 1, bad)
	if err == nil || !strings.Contains(err.Error(), "allow") {
		t.Fatalf("allow_free_text on a number was not refused: %v", err)
	}
}

func TestValidateFormQuestion_NewTypesAreKnownAndTakeNoOptions(t *testing.T) {
	for _, kind := range []models.AnswerType{models.AnswerTimeRange, models.AnswerAddress} {
		q := models.StepQuestion{Prompt: "p", AnswerType: kind}
		if err := validateFormQuestion(invalidFn, 1, q); err != nil {
			t.Errorf("%s refused: %v", kind, err)
		}
		q.Options = []string{"a"}
		if err := validateFormQuestion(invalidFn, 1, q); err == nil {
			t.Errorf("%s accepted options", kind)
		}
	}
}
