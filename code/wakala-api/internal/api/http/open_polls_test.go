package http

import (
	"net/http"
	"testing"
)

func (w pollAnswerWalk) openPolls(t *testing.T, as *http.Cookie) []map[string]any {
	t.Helper()
	rec := w.call(t, "GET", w.polls+"/open", nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("resident lists the open polls: %d %s, want 200", rec.Code, rec.Body.String())
	}
	return decodeObjects(t, rec)
}

func TestOpenPolls_AResidentInTheGroupListsTheQuestionAnswersOnceAndSeesItAnswered(t *testing.T) {
	w := newPollAnswerWalk(t)

	before := w.openPolls(t, w.inside)
	if len(before) != 1 {
		t.Fatalf("resident lists %d open polls, want 1: %v", len(before), before)
	}
	item := before[0]
	if item["id"] != w.pollID || item["question"] != "Bench colour" {
		t.Fatalf("the listed poll is %v, want id %s and question Bench colour", item, w.pollID)
	}
	if answered, _ := item["answered"].(bool); answered {
		t.Fatalf("the poll is listed answered before any answer: %v", item)
	}
	if _, leaked := item["created_by"]; leaked {
		t.Fatalf("the listed poll shows created_by: %v", item)
	}
	choices, _ := item["choices"].([]any)
	if len(choices) != 2 {
		t.Fatalf("the listed poll carries %d choices, want 2: %v", len(choices), item)
	}
	listed := false
	for _, c := range choices {
		row, _ := c.(map[string]any)
		if row["id"] == w.choiceID {
			listed = true
		}
	}
	if !listed {
		t.Fatalf("the choice %s is missing from the listed choices: %v", w.choiceID, choices)
	}

	if code := w.answer(t, w.inside); code != http.StatusCreated {
		t.Fatalf("resident answers the listed poll: %d, want 201", code)
	}
	if code := w.answer(t, w.inside); code != http.StatusConflict {
		t.Fatalf("resident answers again: %d, want 409", code)
	}

	after := w.openPolls(t, w.inside)
	if len(after) != 1 {
		t.Fatalf("resident lists %d open polls after answering, want 1: %v", len(after), after)
	}
	if answered, _ := after[0]["answered"].(bool); !answered {
		t.Fatalf("the poll is not listed answered after the answer: %v", after[0])
	}
}

func TestOpenPolls_AResidentOutsideTheGroupListsNothing(t *testing.T) {
	w := newPollAnswerWalk(t)
	if listed := w.openPolls(t, w.outside); len(listed) != 0 {
		t.Fatalf("resident outside the group lists %d open polls, want 0: %v", len(listed), listed)
	}
}

func TestOpenPolls_TheOwnerCountsTheAnswerAndTheResidentIsRefusedTheCount(t *testing.T) {
	w := newPollAnswerWalk(t)
	if code := w.answer(t, w.inside); code != http.StatusCreated {
		t.Fatalf("resident answers: %d, want 201", code)
	}
	count := w.call(t, "GET", w.polls+"/"+w.pollID+"/count", nil, w.owner)
	if count.Code != http.StatusOK {
		t.Fatalf("owner reads the count: %d %s, want 200", count.Code, count.Body.String())
	}
	body := decodeObject(t, count)
	if answered, _ := body["answered"].(float64); answered != 1 {
		t.Fatalf("the count holds %v answers, want 1: %v", answered, body)
	}
	rows, _ := body["choices"].([]any)
	for _, r := range rows {
		row, _ := r.(map[string]any)
		votes, _ := row["votes"].(float64)
		want := 0.0
		if row["choice_id"] == w.choiceID {
			want = 1
		}
		if votes != want {
			t.Fatalf("choice %v holds %v votes, want %v: %v", row["choice_id"], votes, want, body)
		}
	}
	if rec := w.call(t, "GET", w.polls+"/"+w.pollID+"/count", nil, w.inside); rec.Code != http.StatusForbidden {
		t.Fatalf("resident reads the count: %d %s, want 403", rec.Code, rec.Body.String())
	}
}
