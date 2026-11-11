package http

import (
	"net/http"
	"sync"
	"testing"
)

func (w pollAnswerWalk) twoChoices(t *testing.T, pollID string) []string {
	t.Helper()
	rows := decodeObjects(t, w.call(t, "GET", w.polls+"/"+pollID+"/choices", nil, w.inside))
	ids := make([]string, len(rows))
	for i, row := range rows {
		ids[i], _ = row["id"].(string)
	}
	return ids
}

func (w pollAnswerWalk) replaceTogether(t *testing.T, pollID string, choiceIDs []string, copies int) []int {
	t.Helper()
	codes := make([]int, copies)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range codes {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			choice := choiceIDs[i%len(choiceIDs)]
			codes[i] = w.call(t, "POST", w.polls+"/"+pollID+"/answers", map[string]any{"votes": map[string]int{choice: 1}}, w.inside).Code
		}()
	}
	close(start)
	wg.Wait()
	return codes
}

func TestPollAnswer_ManyReplacesAtOnceNeverFailAndLeaveOneVoteInTotal(t *testing.T) {
	w := newPollAnswerWalk(t)
	for round := 0; round < 8; round++ {
		pollID, _ := w.newPoll(t, true)
		choiceIDs := w.twoChoices(t, pollID)
		w.replaceTogether(t, pollID, choiceIDs, 4)
		for _, code := range w.replaceTogether(t, pollID, choiceIDs, 20) {
			if code >= http.StatusInternalServerError {
				t.Fatalf("round %d: a replace answered %d, want no 5xx", round, code)
			}
		}
		count := decodeObject(t, w.call(t, "GET", w.polls+"/"+pollID+"/count", nil, w.owner))
		if answered, _ := count["answered"].(float64); answered != 1 {
			t.Fatalf("round %d: the count holds %v answers, want 1: %v", round, answered, count)
		}
		votes := 0.0
		choices, _ := count["choices"].([]any)
		for _, c := range choices {
			row, _ := c.(map[string]any)
			n, _ := row["votes"].(float64)
			votes += n
		}
		if votes != 1 {
			t.Fatalf("round %d: the count holds %v votes for one member, want 1: %v", round, votes, count)
		}
	}
}
