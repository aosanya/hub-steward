package http

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

func TestTwoSimultaneousSendsOfOneRunsStepAreOneCreatedAndOneConflict(t *testing.T) {
	plan := []stepSpec{
		{title: "Report", form: "Report form", role: "Volunteer", questions: []agencymodels.StepQuestion{
			{Prompt: "Reason", AnswerType: agencymodels.AnswerFreeText, Required: true},
		}},
		{title: "Confirm", form: "Confirm form", role: "Liaison", questions: []agencymodels.StepQuestion{
			{Prompt: "Arrived", AnswerType: agencymodels.AnswerYesNo, Required: true},
		}},
	}
	w := newStepRunWalk(t, plan, "Volunteer", "Liaison")

	for round := 0; round < 12; round++ {
		sent := w.submit(t, w.people["Volunteer"], "Report", map[string]string{"Reason": "Round " + string(rune('a'+round))}, "")
		if sent.Code != http.StatusCreated {
			t.Fatalf("round %d: the volunteer's submit: %d %s", round, sent.Code, sent.Body.String())
		}
		order, _ := decodeObject(t, sent)["order_id"].(string)

		const senders = 4
		results := make([]*httptest.ResponseRecorder, senders)
		start := make(chan struct{})
		var wg sync.WaitGroup
		for i := 0; i < senders; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				<-start
				results[i] = w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps["Confirm"]+"/answers",
					map[string]any{"answers": map[string]string{"Arrived": "yes"}, "order_id": order}, w.people["Liaison"])
			}(i)
		}
		close(start)
		wg.Wait()

		created, conflicts := 0, 0
		for _, rec := range results {
			switch rec.Code {
			case http.StatusCreated:
				created++
			case http.StatusConflict:
				conflicts++
			default:
				t.Fatalf("round %d: unexpected %d %s", round, rec.Code, rec.Body.String())
			}
		}
		if created != 1 || conflicts != senders-1 {
			t.Fatalf("round %d: %d created and %d conflicts from %d simultaneous sends, want 1 and %d", round, created, conflicts, senders, senders-1)
		}
	}
}
