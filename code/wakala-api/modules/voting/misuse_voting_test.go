package voting

import (
	"context"
	"errors"
	"sync"
	"testing"

	"wakalaserver/modules/voting/models"
)

func TestAnswerPoll_LateVoterCannotAnswerAfterClose(t *testing.T) {
	p := Poll{OpensAt: "2026-11-01T00:00:00Z", ClosesAt: "2026-11-02T00:00:00Z"}
	if insideWindow(p, "2026-11-02T00:00:01Z") {
		t.Fatal("answer after close admitted")
	}
	if insideWindow(p, "2026-10-31T23:59:59Z") {
		t.Fatal("answer before open admitted")
	}
	if !insideWindow(p, "2026-11-01T12:00:00Z") {
		t.Fatal("answer inside window refused")
	}
}

func TestAnswerPoll_OutsiderCannotAnswerPollOfAnotherGroup(t *testing.T) {
	p := Poll{GroupIDs: []string{"g-ward"}, PerGroup: models.PerGroupOnce}
	if _, err := answeringGroup(p, "", []string{"g-other"}); !errors.Is(err, ErrNotInPollGroups) {
		t.Fatalf("outsider admitted: %v", err)
	}
	if _, err := answeringGroup(p, "", nil); !errors.Is(err, ErrNotInPollGroups) {
		t.Fatalf("caller with no group admitted: %v", err)
	}
	if _, err := answeringGroup(p, "", []string{"g-ward"}); err != nil {
		t.Fatalf("group member refused: %v", err)
	}
}
func TestAnswerPoll_SameVoterCannotAnswerTwiceConcurrently(t *testing.T) {
	pm, _, _, id := publishedPollFixture(t)
	ctx := context.Background()
	choices, err := pm.ListChoices(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	var mu sync.Mutex
	admitted := 0
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := pm.AnswerPoll(ctx, Answer{PollID: id, AnsweredBy: "resident-dup", Votes: map[string]int{choices[0].ID: 1}})
			if err == nil {
				mu.Lock()
				admitted++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	c, err := pm.CountPoll(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if admitted != 1 || c.Answered != 1 || c.Choices[0].Votes != 1 {
		t.Fatalf("admitted=%d answered=%d votes=%d", admitted, c.Answered, c.Choices[0].Votes)
	}
	if _, err := pm.AnswerPoll(ctx, Answer{PollID: id, AnsweredBy: "resident-other", Votes: map[string]int{choices[1].ID: 1}}); err != nil {
		t.Fatalf("second resident refused: %v", err)
	}
}
