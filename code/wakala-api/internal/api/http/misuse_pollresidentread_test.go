package http

import (
	"net/http"
	"testing"
	"time"
)

func pollWithWindow(t *testing.T, w stepRunWalk, polls, groupID string, opensIn, closesIn time.Duration, as *http.Cookie) string {
	t.Helper()
	made := w.call(t, "POST", polls, map[string]any{
		"question": "Bench colour", "mode": "one", "per_group": "once", "group_ids": []string{groupID},
		"opens_at":  time.Now().Add(opensIn).UTC().Format(time.RFC3339),
		"closes_at": time.Now().Add(closesIn).UTC().Format(time.RFC3339),
		"choices":   []map[string]any{{"label": "green"}, {"label": "blue"}},
	}, as)
	if made.Code != http.StatusCreated {
		t.Fatalf("create the poll: %d %s", made.Code, made.Body.String())
	}
	id, _ := decodeObject(t, made)["id"].(string)
	return polls + "/" + id
}

func expectRead(t *testing.T, w stepRunWalk, who string, as *http.Cookie, pollPath string, want int) {
	t.Helper()
	for _, suffix := range []string{"", "/choices"} {
		if rec := w.call(t, "GET", pollPath+suffix, nil, as); rec.Code != want {
			t.Fatalf("%s reads %q: %d %s, want %d", who, suffix, rec.Code, rec.Body.String(), want)
		}
	}
}

func TestPollResidentRead_AResidentOutsideThePollsGroupsReadsNeitherAnOpenPollNorItsChoices(t *testing.T) {
	w := newPollAnswerWalk(t)
	expectRead(t, w.stepRunWalk, "outside resident", w.outside, w.polls+"/"+w.pollID, http.StatusNotFound)
}

func TestPollResidentRead_AResidentInThePollsGroupsReadsAnOpenPollAndItsChoices(t *testing.T) {
	w := newPollAnswerWalk(t)
	expectRead(t, w.stepRunWalk, "inside resident", w.inside, w.polls+"/"+w.pollID, http.StatusOK)
}

func TestPollResidentRead_AResidentInThePollsGroupsCannotReadADraftPollNotYetOpen(t *testing.T) {
	w := newPollAnswerWalk(t)
	draft := pollWithWindow(t, w.stepRunWalk, w.polls, w.groupID, time.Hour, 48*time.Hour, w.owner)
	expectRead(t, w.stepRunWalk, "inside resident", w.inside, draft, http.StatusNotFound)
	expectRead(t, w.stepRunWalk, "outside resident", w.outside, draft, http.StatusNotFound)
}

func TestPollResidentRead_TheOwnerReadsADraftPollAndItsChoices(t *testing.T) {
	w := newPollAnswerWalk(t)
	draft := pollWithWindow(t, w.stepRunWalk, w.polls, w.groupID, time.Hour, 48*time.Hour, w.owner)
	expectRead(t, w.stepRunWalk, "owner", w.owner, draft, http.StatusOK)
}

func TestPollResidentRead_ThePollRunnerReadsADraftPollAndItsChoices(t *testing.T) {
	w := newPollRunReadWalk(t)
	draft := pollWithWindow(t, w.stepRunWalk, w.polls, w.groupID, time.Hour, 48*time.Hour, w.runner)
	expectRead(t, w.stepRunWalk, "runner", w.runner, draft, http.StatusOK)
}

func TestPollResidentRead_AClosedPollStaysReadableToItsGroupsAndNotToOthers(t *testing.T) {
	w := newPollAnswerWalk(t)
	closed := pollWithWindow(t, w.stepRunWalk, w.polls, w.groupID, -2*time.Hour, -time.Hour, w.owner)
	expectRead(t, w.stepRunWalk, "inside resident", w.inside, closed, http.StatusOK)
	expectRead(t, w.stepRunWalk, "outside resident", w.outside, closed, http.StatusNotFound)
}

func TestPollResidentRead_AResidentInTheGroupStillReadsThePollAfterAnswering(t *testing.T) {
	w := newPollAnswerWalk(t)
	if code := w.answer(t, w.inside); code != http.StatusCreated {
		t.Fatalf("resident answers: %d, want 201", code)
	}
	expectRead(t, w.stepRunWalk, "inside resident", w.inside, w.polls+"/"+w.pollID, http.StatusOK)
}
