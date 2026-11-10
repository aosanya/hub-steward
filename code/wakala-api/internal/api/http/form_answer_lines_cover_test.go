package http

import (
	"testing"

	formsmodels "wakalaserver/modules/forms/models"
)

func answerFloat(v float64) *float64 { return &v }
func answerBool(v bool) *bool        { return &v }

func TestAnswerLinesReadsEachAnswerTypeTheWayAPersonWouldSayIt(t *testing.T) {
	questions := []formsmodels.Question{
		{ID: "q1", Prompt: "Was it open", AnswerType: formsmodels.AnswerYesNo},
		{ID: "q2", Prompt: "Was it clean", AnswerType: formsmodels.AnswerYesNo, YesLabel: "Spotless", NoLabel: "Dirty"},
		{ID: "q3", Prompt: "Which tool", AnswerType: formsmodels.AnswerMultiSelect},
		{ID: "q4", Prompt: "When", AnswerType: formsmodels.AnswerDate},
		{ID: "q5", Prompt: "At", AnswerType: formsmodels.AnswerTime},
		{ID: "q6", Prompt: "How far", AnswerType: formsmodels.AnswerNumber, UnitLabel: "km"},
		{ID: "q7", Prompt: "Cost", AnswerType: formsmodels.AnswerCurrency, CurrencyCode: "EUR"},
		{ID: "q8", Prompt: "Photos", AnswerType: formsmodels.AnswerPhoto},
		{ID: "q9", Prompt: "Notes", AnswerType: formsmodels.AnswerFreeText},
		{ID: "q10", Prompt: "Never answered", AnswerType: formsmodels.AnswerFreeText},
	}
	labels := map[string]string{"a": "Spade", "b": "Rake"}
	stored := []formsmodels.Answer{
		{QuestionID: "q1", ValueBool: answerBool(true)},
		{QuestionID: "q2", ValueBool: answerBool(false)},
		{QuestionID: "q3", OptionIDs: []string{"a", "gone", "b"}},
		{QuestionID: "q4", ValueDate: "2026-11-10"},
		{QuestionID: "q5", ValueTime: "08:30"},
		{QuestionID: "q6", ValueNumber: answerFloat(12.5)},
		{QuestionID: "q7", ValueNumber: answerFloat(40)},
		{QuestionID: "q8", FileIDs: []string{"f1", "f2"}},
		{QuestionID: "q9", ValueText: "  all fine  "},
	}
	want := "Was it open: Yes\nWas it clean: Dirty\nWhich tool: Spade, Rake\nWhen: 2026-11-10\nAt: 08:30\nHow far: 12.5 km\nCost: EUR 40\nPhotos: 2 attached\nNotes: all fine"
	if got := answerLines(questions, labels, stored); got != want {
		t.Fatalf("answer lines:\n%s\nwant:\n%s", got, want)
	}
}

func TestAnswerLinesSkipsAnswersThatSayNothing(t *testing.T) {
	questions := []formsmodels.Question{
		{ID: "q1", Prompt: "Open", AnswerType: formsmodels.AnswerYesNo},
		{ID: "q2", Prompt: "Cost", AnswerType: formsmodels.AnswerCurrency, CurrencyCode: "EUR"},
		{ID: "q3", Prompt: "Photos", AnswerType: formsmodels.AnswerFile},
		{ID: "q4", Prompt: "Which", AnswerType: formsmodels.AnswerSingleChoice},
	}
	stored := []formsmodels.Answer{
		{QuestionID: "q1"},
		{QuestionID: "q2"},
		{QuestionID: "q3"},
		{QuestionID: "q4", OptionIDs: []string{"unknown"}},
		{QuestionID: "not-asked", ValueText: "stray"},
	}
	if got := answerLines(questions, nil, stored); got != "Cost: EUR" {
		t.Fatalf("an unanswered yes/no, empty files and unknown options must not make lines, got %q", got)
	}
	if got := answerLines(nil, nil, nil); got != "" {
		t.Fatalf("no questions must give no lines, got %q", got)
	}
}

func TestYesLabelOnlyReplacesYes(t *testing.T) {
	q := formsmodels.Question{YesLabel: "Done"}
	if got := yesNoText(q, formsmodels.Answer{ValueBool: answerBool(true)}); got != "Done" {
		t.Fatalf("yes label: %q", got)
	}
	if got := yesNoText(q, formsmodels.Answer{ValueBool: answerBool(false)}); got != "No" {
		t.Fatalf("no without its own label stays No, got %q", got)
	}
}
