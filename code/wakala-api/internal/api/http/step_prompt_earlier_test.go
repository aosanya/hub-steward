package http

import (
	"net/http"
	"reflect"
	"testing"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func promptedPlan() []stepSpec {
	return []stepSpec{
		{title: "Report a referral", prompt: "Ask the family why they were sent.", form: "Referral", role: "Volunteer", questions: []agencymodels.StepQuestion{
			{Prompt: "Reason", AnswerType: agencymodels.AnswerFreeText, Required: true},
			{Prompt: "Minutes to the clinic", AnswerType: agencymodels.AnswerNumber, Required: true},
			{Prompt: "Needs transport", AnswerType: agencymodels.AnswerYesNo},
		}},
		{title: "Confirm arrival", prompt: "Call the clinic and ask who arrived.", form: "Arrival", role: "Liaison", questions: []agencymodels.StepQuestion{
			{Prompt: "Arrived", AnswerType: agencymodels.AnswerYesNo, Required: true},
		}},
	}
}

func prompted(t *testing.T) stepRunWalk {
	t.Helper()
	return newStepRunWalk(t, promptedPlan(), "Volunteer", "Liaison")
}

func earlierOf(t *testing.T, item map[string]any) []map[string]any {
	t.Helper()
	raw, _ := item["earlier"].([]any)
	out := []map[string]any{}
	for _, entry := range raw {
		out = append(out, entry.(map[string]any))
	}
	return out
}

func TestAStartStepCarriesItsPromptAndNoEarlierAnswers(t *testing.T) {
	w := prompted(t)
	start := w.available(t, w.people["Volunteer"])[0]
	if start["prompt"] != "Ask the family why they were sent." {
		t.Errorf("a start step's prompt = %v", start["prompt"])
	}
	if _, has := start["earlier"]; has {
		t.Errorf("a start step carries earlier answers: %v", start["earlier"])
	}
}

func TestTheNextStepCarriesItsPrompt(t *testing.T) {
	w := prompted(t)
	sent := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Needs a clinic check", "Minutes to the clinic": "25"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the volunteer's submit: %d %s", sent.Code, sent.Body.String())
	}
	next, _ := decodeObject(t, sent)["next_step"].(map[string]any)
	if next["prompt"] != "Call the clinic and ask who arrived." {
		t.Errorf("the next step's prompt = %v", next["prompt"])
	}
}

func TestAWaitingStepCarriesItsPromptAndWhatTheEarlierRolesAnswered(t *testing.T) {
	w := prompted(t)
	sent := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Minutes to the clinic": "25", "Needs transport": "yes", "Reason": "Needs a clinic check"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the volunteer's submit: %d %s", sent.Code, sent.Body.String())
	}
	waiting := w.available(t, w.people["Liaison"])[0]
	if waiting["prompt"] != "Call the clinic and ask who arrived." {
		t.Errorf("a waiting step's prompt = %v", waiting["prompt"])
	}
	earlier := earlierOf(t, waiting)
	if len(earlier) != 1 {
		t.Fatalf("a waiting step's earlier = %v, want the volunteer's step", waiting["earlier"])
	}
	if earlier[0]["step_title"] != "Report a referral" || earlier[0]["role_name"] != "Volunteer" {
		t.Errorf("the earlier step = %v", earlier[0])
	}
	want := []any{
		map[string]any{"prompt": "Reason", "answer": "Needs a clinic check"},
		map[string]any{"prompt": "Minutes to the clinic", "answer": "25"},
		map[string]any{"prompt": "Needs transport", "answer": "yes"},
	}
	if !reflect.DeepEqual(earlier[0]["answers"], want) {
		t.Errorf("the earlier answers = %v, want %v in question order", earlier[0]["answers"], want)
	}
}

func TestAnEarlierStepLeavesOutTheQuestionsNobodyAnswered(t *testing.T) {
	w := prompted(t)
	sent := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Needs a clinic check", "Minutes to the clinic": "25"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the volunteer's submit: %d %s", sent.Code, sent.Body.String())
	}
	earlier := earlierOf(t, w.available(t, w.people["Liaison"])[0])
	if len(earlier) != 1 {
		t.Fatalf("a waiting step's earlier = %v, want the volunteer's step", earlier)
	}
	answers, _ := earlier[0]["answers"].([]any)
	if len(answers) != 2 {
		t.Errorf("the earlier answers = %v, want the two that were answered", answers)
	}
}
