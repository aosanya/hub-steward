package http

import (
	"net/http"
	"reflect"
	"testing"
)

func TestTheFollowingRoleSeesTheAnswerTheLiaisonChanged(t *testing.T) {
	w := newStepRunWalk(t, amendmentPlan(), "Volunteer", "Liaison", "Doctor")
	first := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Needs a clinic check", "Minutes to the clinic": "25"}, "")
	if first.Code != http.StatusCreated {
		t.Fatalf("the volunteer's submit: %d %s", first.Code, first.Body.String())
	}
	orderID, _ := decodeObject(t, first)["order_id"].(string)
	sent := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes", amendmentPrompt: amendmentText}, orderID)
	if sent.Code != http.StatusCreated {
		t.Fatalf("the liaison's submit: %d %s", sent.Code, sent.Body.String())
	}

	waiting := w.available(t, w.people["Doctor"])
	if len(waiting) != 1 {
		t.Fatalf("the doctor's waiting steps = %v", waiting)
	}
	earlier := earlierOf(t, waiting[0])
	if len(earlier) != 2 {
		t.Fatalf("the doctor's earlier = %v, want the volunteer's and the liaison's steps", earlier)
	}
	want := map[string]any{"prompt": amendmentPrompt, "answer": amendmentText}
	answers, _ := earlier[1]["answers"].([]any)
	for _, answer := range answers {
		if reflect.DeepEqual(answer, want) {
			return
		}
	}
	t.Errorf("the liaison's earlier answers = %v, want one to be %v", answers, want)
}
