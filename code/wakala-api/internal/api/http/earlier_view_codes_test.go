package http

import (
	"net/http"
	"reflect"
	"testing"
)

func volunteerSent(t *testing.T, w stepRunWalk) string {
	t.Helper()
	sent := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Needs a clinic check", "Minutes to the clinic": "25", "Needs transport": "yes"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the volunteer's submit: %d %s", sent.Code, sent.Body.String())
	}
	order, _ := decodeObject(t, sent)["order_id"].(string)
	return order
}

func TestEarlierAnswersLeaveOutTheFieldsThePersonHoldsNoViewCodeFor(t *testing.T) {
	w := prompted(t)
	volunteerSent(t, w)
	w.holdingOnly("Liaison", w.viewCode(t, "Report a referral", "Reason"), w.viewCode(t, "Report a referral", "Needs transport"))

	earlier := earlierOf(t, w.available(t, w.people["Liaison"])[0])
	if len(earlier) != 1 {
		t.Fatalf("earlier = %v, want the volunteer's step", earlier)
	}
	want := []any{
		map[string]any{"prompt": "Reason", "answer": "Needs a clinic check"},
		map[string]any{"prompt": "Needs transport", "answer": "yes"},
	}
	if !reflect.DeepEqual(earlier[0]["answers"], want) {
		t.Errorf("the earlier answers = %v, want only the two fields the liaison may view: %v", earlier[0]["answers"], want)
	}
}

func TestEarlierAnswersShowEveryFieldToAPersonWhoViewsTheWholeRecord(t *testing.T) {
	w := prompted(t)
	volunteerSent(t, w)
	w.holdingOnly("Liaison", w.viewCode(t, "Report a referral", ""))

	earlier := earlierOf(t, w.available(t, w.people["Liaison"])[0])
	if len(earlier) != 1 {
		t.Fatalf("earlier = %v, want the volunteer's step", earlier)
	}
	if answers, _ := earlier[0]["answers"].([]any); len(answers) != 3 {
		t.Errorf("the earlier answers = %v, want all three", earlier[0]["answers"])
	}
}

func TestAPersonWithNoViewCodesSeesNoEarlierAnswersAndStillGetsTheStep(t *testing.T) {
	w := prompted(t)
	volunteerSent(t, w)
	w.holdingOnly("Liaison")

	waiting := w.available(t, w.people["Liaison"])
	if len(waiting) != 1 {
		t.Fatalf("the liaison's waiting steps = %v, want the arrival step", waiting)
	}
	if earlier := earlierOf(t, waiting[0]); len(earlier) != 0 {
		t.Errorf("earlier = %v, want none for a person with no view code", earlier)
	}
}

func TestAViewCodeOfAnotherRecordShowsNothingOfThisOne(t *testing.T) {
	w := prompted(t)
	volunteerSent(t, w)
	w.holdingOnly("Liaison", w.viewCode(t, "Confirm arrival", ""))

	if earlier := earlierOf(t, w.available(t, w.people["Liaison"])[0]); len(earlier) != 0 {
		t.Errorf("earlier = %v, want none: the view code is of the arrival record", earlier)
	}
}

func TestAChangedAnswerOfAHiddenFieldIsHiddenToo(t *testing.T) {
	w := newStepRunWalk(t, amendmentPlan(), "Volunteer", "Liaison", "Doctor")
	order := volunteerSent(t, w)
	sent := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes", amendmentPrompt: amendmentText}, order)
	if sent.Code != http.StatusCreated {
		t.Fatalf("the liaison's submit: %d %s", sent.Code, sent.Body.String())
	}
	w.holdingOnly("Doctor", w.viewCode(t, "Confirm arrival", "Arrived"))

	earlier := earlierOf(t, w.available(t, w.people["Doctor"])[0])
	if len(earlier) != 1 || earlier[0]["step_title"] != "Confirm arrival" {
		t.Fatalf("earlier = %v, want only the liaison's step", earlier)
	}
	want := []any{map[string]any{"prompt": "Arrived", "answer": "yes"}}
	if !reflect.DeepEqual(earlier[0]["answers"], want) {
		t.Errorf("the liaison's earlier answers = %v, want %v without the change to a hidden field", earlier[0]["answers"], want)
	}
}

func TestTheViewCodesAreTheViewersAndNotTheRoleThatAnswered(t *testing.T) {
	w := prompted(t)
	volunteerSent(t, w)
	w.holdingOnly("Volunteer")
	w.holdingOnly("Liaison", w.viewCode(t, "Report a referral", "Reason"))

	liaison := earlierOf(t, w.available(t, w.people["Liaison"])[0])
	answers, _ := liaison[0]["answers"].([]any)
	if len(answers) != 1 {
		t.Errorf("the liaison's earlier answers = %v, want the one field she may view", answers)
	}
}
