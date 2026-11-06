package http

import (
	"net/http"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

func TestTwoStepsOfOneWorkflowWithTheSameTitleStayTwoSteps(t *testing.T) {
	plan := []stepSpec{
		{title: "Check", form: "First check", role: "Volunteer", questions: []agencymodels.StepQuestion{
			{Prompt: "Seen", AnswerType: agencymodels.AnswerYesNo, Required: true},
		}},
		{title: "Check", form: "Second check", role: "Liaison", questions: []agencymodels.StepQuestion{
			{Prompt: "Confirmed", AnswerType: agencymodels.AnswerYesNo, Required: true},
		}},
	}
	w := newStepRunWalk(t, plan, "Volunteer", "Liaison")

	first := w.available(t, w.people["Volunteer"])
	if len(first) != 1 {
		t.Fatalf("the volunteer sees %v, want the first check", first)
	}
	w.steps["first"], _ = first[0]["id"].(string)

	sent := w.submit(t, w.people["Volunteer"], "first", map[string]string{"Seen": "yes"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the volunteer's submit: %d %s", sent.Code, sent.Body.String())
	}
	order, _ := decodeObject(t, sent)["order_id"].(string)

	liaison := w.available(t, w.people["Liaison"])
	if len(liaison) != 1 || liaison[0]["state"] != "waiting" || liaison[0]["order_id"] != order {
		t.Fatalf("the liaison sees %v, want the second check waiting on run %s", liaison, order)
	}
}
