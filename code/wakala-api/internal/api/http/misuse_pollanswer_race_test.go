package http

import (
	"net/http"
	"sort"
	"sync"
	"testing"
	"time"
)

func (w pollAnswerWalk) answerTogether(t *testing.T, as *http.Cookie, pollID, choiceID string, copies int) map[int]int {
	t.Helper()
	codes := make([]int, copies)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range codes {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			rec := w.call(t, "POST", w.polls+"/"+pollID+"/answers", map[string]any{"votes": map[string]int{choiceID: 1}}, as)
			codes[i] = rec.Code
		}()
	}
	close(start)
	wg.Wait()
	tally := map[int]int{}
	for _, code := range codes {
		tally[code]++
	}
	return tally
}

func (w pollAnswerWalk) newPoll(t *testing.T, changeAllowed bool) (string, string) {
	t.Helper()
	made := w.call(t, "POST", w.polls, map[string]any{
		"question": "Bench colour", "mode": "one", "per_group": "once", "group_ids": []string{w.groupID}, "change_allowed": changeAllowed,
		"opens_at": time.Now().Add(-time.Hour).UTC().Format(time.RFC3339), "closes_at": time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
		"choices": []map[string]any{{"label": "green"}, {"label": "blue"}},
	}, w.owner)
	if made.Code != http.StatusCreated {
		t.Fatalf("owner creates the poll: %d %s", made.Code, made.Body.String())
	}
	id, _ := decodeObject(t, made)["id"].(string)
	choices := w.call(t, "GET", w.polls+"/"+id+"/choices", nil, w.inside)
	choiceID, _ := decodeObjects(t, choices)[0]["id"].(string)
	return id, choiceID
}

func codesOf(tally map[int]int) []int {
	codes := make([]int, 0, len(tally))
	for code := range tally {
		codes = append(codes, code)
	}
	sort.Ints(codes)
	return codes
}

func TestPollAnswer_FifteenTapsAtOnceGiveOneCreatedAndTheRestConflict(t *testing.T) {
	w := newPollAnswerWalk(t)
	pollID, choiceID := w.newPoll(t, false)
	tally := w.answerTogether(t, w.inside, pollID, choiceID, 15)
	for _, code := range codesOf(tally) {
		if code != http.StatusCreated && code != http.StatusConflict {
			t.Fatalf("simultaneous taps answered %v, want only 201 and 409", tally)
		}
	}
	if tally[http.StatusCreated] != 1 {
		t.Fatalf("simultaneous taps stored %d answers, want 1: %v", tally[http.StatusCreated], tally)
	}
}

func TestPollAnswer_TwentyChangesAtOnceNeverFailAndLeaveOneVote(t *testing.T) {
	w := newPollAnswerWalk(t)
	pollID, choiceID := w.newPoll(t, true)
	tally := w.answerTogether(t, w.inside, pollID, choiceID, 20)
	for _, code := range codesOf(tally) {
		if code >= http.StatusInternalServerError {
			t.Fatalf("simultaneous changes answered %v, want no 5xx", tally)
		}
	}
	count := w.call(t, "GET", w.polls+"/"+pollID+"/count", nil, w.owner)
	if answered, _ := decodeObject(t, count)["answered"].(float64); answered != 1 {
		t.Fatalf("the count holds %v answers, want 1: %s", answered, count.Body.String())
	}
}
