package http

import (
	"net/http"
	"testing"
	"time"
)

const forgedAuthor = "forged-clerk"

func TestPollAuthor_AnAnswerNamesTheSignedInResidentNotTheBody(t *testing.T) {
	w := newPollAnswerWalk(t)
	rec := w.call(t, "POST", w.polls+"/"+w.pollID+"/answers", map[string]any{
		"votes":       map[string]int{w.choiceID: 1},
		"answered_by": forgedAuthor,
	}, w.inside)
	if rec.Code != http.StatusCreated {
		t.Fatalf("resident answers with a forged answered_by: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if named, _ := decodeObject(t, rec)["answered_by"].(string); named == forgedAuthor {
		t.Fatalf("the answer names %q, the body's value", named)
	}
	own := w.call(t, "GET", w.polls+"/"+w.pollID+"/responses/mine", nil, w.inside)
	if own.Code != http.StatusOK {
		t.Fatalf("the resident reads their own response: %d %s, want 200, the answer being theirs", own.Code, own.Body.String())
	}
	listed := w.call(t, "GET", w.polls+"/"+w.pollID+"/responses", nil, w.owner)
	if listed.Code != http.StatusOK {
		t.Fatalf("owner lists responses: %d %s", listed.Code, listed.Body.String())
	}
	items, _ := decodeObject(t, listed)["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("the poll has %d responses, want 1", len(items))
	}
	for _, item := range items {
		if response, _ := item.(map[string]any); response["answered_by"] == forgedAuthor {
			t.Fatalf("a response is kept under %q, the body's value", forgedAuthor)
		}
	}
}

func TestPollAuthor_ARepeatAnswerUnderAForgedNameIsStillRefused(t *testing.T) {
	w := newPollAnswerWalk(t)
	body := map[string]any{"votes": map[string]int{w.choiceID: 1}}
	if rec := w.call(t, "POST", w.polls+"/"+w.pollID+"/answers", body, w.inside); rec.Code != http.StatusCreated {
		t.Fatalf("first answer: %d %s", rec.Code, rec.Body.String())
	}
	body["answered_by"] = forgedAuthor
	if rec := w.call(t, "POST", w.polls+"/"+w.pollID+"/answers", body, w.inside); rec.Code != http.StatusConflict {
		t.Fatalf("the same resident answers again under a forged name: %d %s, want 409", rec.Code, rec.Body.String())
	}
}

func TestPollAuthor_APollNamesTheSignedInMakerNotTheBody(t *testing.T) {
	w := newPollAnswerWalk(t)
	made := w.call(t, "POST", w.polls, map[string]any{
		"question": "Bench colour", "mode": "one", "per_group": "once", "group_ids": []string{w.groupID},
		"opens_at": time.Now().Add(-time.Hour).UTC().Format(time.RFC3339), "closes_at": time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
		"choices":    []map[string]any{{"label": "green"}, {"label": "blue"}},
		"created_by": forgedAuthor,
	}, w.owner)
	if made.Code != http.StatusCreated {
		t.Fatalf("owner makes a poll with a forged created_by: %d %s", made.Code, made.Body.String())
	}
	if named, _ := decodeObject(t, made)["created_by"].(string); named == forgedAuthor || named == "" {
		t.Fatalf("the poll names %q as its maker, want the signed-in owner", named)
	}
}

func TestPollAuthor_AResultNamesTheSignedInPublisherNotTheBody(t *testing.T) {
	w := newPollAnswerWalk(t)
	made := w.call(t, "POST", w.polls, map[string]any{
		"question": "Bench colour", "mode": "one", "per_group": "once", "group_ids": []string{w.groupID},
		"opens_at": time.Now().Add(-2 * time.Hour).UTC().Format(time.RFC3339), "closes_at": time.Now().Add(-time.Hour).UTC().Format(time.RFC3339),
		"choices": []map[string]any{{"label": "green"}, {"label": "blue"}},
	}, w.owner)
	if made.Code != http.StatusCreated {
		t.Fatalf("owner makes a closed poll: %d %s", made.Code, made.Body.String())
	}
	pollID, _ := decodeObject(t, made)["id"].(string)
	published := w.call(t, "POST", w.polls+"/"+pollID+"/result", map[string]any{
		"group_ids": []string{w.groupID}, "published_by": forgedAuthor,
	}, w.owner)
	if published.Code != http.StatusOK {
		t.Fatalf("owner publishes with a forged published_by: %d %s, want 200", published.Code, published.Body.String())
	}
	if named, _ := decodeObject(t, published)["published_by"].(string); named == forgedAuthor || named == "" {
		t.Fatalf("the result names %q as its publisher, want the signed-in owner", named)
	}
}
