package reviewruns

import (
	"context"
	"errors"
	"strings"
	"testing"
)

const emptyAnswerJSON = `{"summary":"fine","findings":[]}`

func readerOf(text string, err error) DraftReader {
	return DraftReaderFunc(func(context.Context, string) (string, error) { return text, err })
}

func TestEachReviewerReportsItsAreaAndSendsTheDraftWithItsOwnPrompt(t *testing.T) {
	cases := []struct {
		area   string
		make   func(Model, DraftReader) Reviewer
		prompt string
	}{
		{AreaProfile, func(m Model, r DraftReader) Reviewer { return NewProfileReviewer(m, r) }, profileSystemPrompt},
		{AreaGoals, func(m Model, r DraftReader) Reviewer { return NewGoalsReviewer(m, r) }, goalsSystemPrompt},
		{AreaObjectives, func(m Model, r DraftReader) Reviewer { return NewObjectivesReviewer(m, r) }, objectivesSystemPrompt},
		{AreaRisks, func(m Model, r DraftReader) Reviewer { return NewRisksReviewer(m, r) }, risksSystemPrompt},
		{AreaTests, func(m Model, r DraftReader) Reviewer { return NewTestsReviewer(m, r) }, testsSystemPrompt},
	}
	for _, c := range cases {
		model := &fakeModel{answer: Completion{Text: emptyAnswerJSON, Tokens: 3}}
		reviewer := c.make(model, readerOf("THE DRAFT", nil))
		if reviewer.Area() != c.area {
			t.Errorf("%s: Area = %s", c.area, reviewer.Area())
		}
		result, err := reviewer.Review(context.Background(), AreaInput{Area: c.area, DraftID: "d1"})
		if err != nil {
			t.Fatalf("%s: %v", c.area, err)
		}
		if result.Summary != "fine" || result.Tokens != 3 {
			t.Errorf("%s: result = %+v", c.area, result)
		}
		if model.system != c.prompt || !strings.Contains(model.user, "THE DRAFT") {
			t.Errorf("%s: model saw the wrong prompt or draft", c.area)
		}
	}
}

func TestEachReviewerStopsWhenTheDraftCannotBeRead(t *testing.T) {
	boom := errors.New("cannot read")
	makers := map[string]func(Model, DraftReader) Reviewer{
		AreaProfile:    func(m Model, r DraftReader) Reviewer { return NewProfileReviewer(m, r) },
		AreaGoals:      func(m Model, r DraftReader) Reviewer { return NewGoalsReviewer(m, r) },
		AreaObjectives: func(m Model, r DraftReader) Reviewer { return NewObjectivesReviewer(m, r) },
		AreaRisks:      func(m Model, r DraftReader) Reviewer { return NewRisksReviewer(m, r) },
		AreaTests:      func(m Model, r DraftReader) Reviewer { return NewTestsReviewer(m, r) },
	}
	for area, make := range makers {
		model := &fakeModel{answer: Completion{Text: emptyAnswerJSON}}
		_, err := make(model, readerOf("", boom)).Review(context.Background(), AreaInput{DraftID: "d1"})
		if err == nil || !strings.Contains(err.Error(), "cannot read") {
			t.Errorf("%s: err = %v", area, err)
		}
		if model.user != "" {
			t.Errorf("%s: the model was asked although the draft could not be read", area)
		}
	}
}

func TestObjectivesReviewerSaysWhichAreaCouldNotBeRead(t *testing.T) {
	_, err := NewObjectivesReviewer(&fakeModel{}, readerOf("", errors.New("down"))).Review(context.Background(), AreaInput{})
	if err == nil || !strings.HasPrefix(err.Error(), "The objectives of this draft could not be read") {
		t.Errorf("err = %v", err)
	}
}

func TestTestsReviewerStripsAnyAdviceToRunAScenario(t *testing.T) {
	answer := `{"summary":"s","findings":[
		{"title":"Run it","detail":"d","fate":"new","tool":"agency_run_scenario","arguments":{"id":"1"}},
		{"title":"Run later","detail":"d","fate":"new","tool":"agency_add_scenario","then":[{"tool":"agency_run_scenario"}]},
		{"title":"Add it","detail":"d","fate":"new","tool":"agency_add_scenario","arguments":{"n":"x"}}]}`
	model := &fakeModel{answer: Completion{Text: answer}}
	result, err := NewTestsReviewer(model, readerOf("draft", nil)).Review(context.Background(), AreaInput{})
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range result.Findings[:2] {
		if f.Tool != "" || f.Arguments != nil || f.Then != "" {
			t.Errorf("%s still carries an action: %+v", f.Title, f)
		}
	}
	if kept := result.Findings[2]; kept.Tool != "agency_add_scenario" || kept.Arguments["n"] != "x" {
		t.Errorf("a finding that runs nothing lost its action: %+v", kept)
	}
}

func TestTestsReviewerPassesAModelFailureOn(t *testing.T) {
	boom := errors.New("model down")
	_, err := NewTestsReviewer(&fakeModel{err: boom}, readerOf("draft", nil)).Review(context.Background(), AreaInput{})
	if !errors.Is(err, boom) {
		t.Errorf("err = %v", err)
	}
}
