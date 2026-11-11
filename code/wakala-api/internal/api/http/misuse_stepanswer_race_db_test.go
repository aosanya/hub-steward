package http

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

func TestStepAnswers_FifteenSendsAtOnceOnPostgresGiveOneCreatedAndTheRestConflict(t *testing.T) {
	db := localPostgresOrSkip(t)
	plan := []stepSpec{
		{title: "Report", form: "Report form", role: "Volunteer", questions: []agencymodels.StepQuestion{
			{Prompt: "Reason", AnswerType: agencymodels.AnswerFreeText, Required: true},
		}},
		{title: "Confirm", form: "Confirm form", role: "Liaison", questions: []agencymodels.StepQuestion{
			{Prompt: "Arrived", AnswerType: agencymodels.AnswerYesNo, Required: true},
		}},
	}
	for round := 0; round < 3; round++ {
		w := newStepRunWalkOn(t, db, plan, "Volunteer", "Liaison")
		sent := w.submit(t, w.people["Volunteer"], "Report", map[string]string{"Reason": "Lights out"}, "")
		if sent.Code != http.StatusCreated {
			t.Fatalf("round %d: the volunteer's submit: %d %s", round, sent.Code, sent.Body.String())
		}
		order, _ := decodeObject(t, sent)["order_id"].(string)
		results := make([]*httptest.ResponseRecorder, 15)
		start := make(chan struct{})
		var wg sync.WaitGroup
		for i := range results {
			wg.Add(1)
			go func() {
				defer wg.Done()
				<-start
				results[i] = w.submit(t, w.people["Liaison"], "Confirm", map[string]string{"Arrived": "yes"}, order)
			}()
		}
		close(start)
		wg.Wait()
		tally := map[int]int{}
		for _, rec := range results {
			tally[rec.Code]++
		}
		if tally[http.StatusCreated] != 1 || tally[http.StatusConflict] != len(results)-1 {
			t.Fatalf("round %d: simultaneous sends answered %v, want one 201 and the rest 409", round, tally)
		}
	}
}
