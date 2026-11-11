package http

import (
	"net/http"
	"testing"
	"time"
)

func TestPollGroups_OwnerCannotDoAimAPollOrItsResultAtAGroupOutsideTheAgency(t *testing.T) {
	w := newStepRunWalk(t, nil)
	other := newStepRunWalk(t, nil)
	foreign := other.call(t, "POST", "/instances/"+other.instance+"/actor/groups", map[string]any{"name": "Other ward"}, other.owner)
	foreignID, _ := decodeObject(t, foreign)["id"].(string)
	own := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": "Own ward"}, w.owner)
	ownID, _ := decodeObject(t, own)["id"].(string)
	polls := "/instances/" + w.instance + "/voting/polls"
	poll := func(groups []string) map[string]any {
		return map[string]any{"question": "Bench colour", "mode": "one", "per_group": "once", "group_ids": groups,
			"opens_at": time.Now().Add(time.Hour).UTC().Format(time.RFC3339), "closes_at": time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339),
			"choices": []map[string]any{{"label": "green"}, {"label": "blue"}}}
	}
	admitted := w.call(t, "POST", polls, poll([]string{ownID}), w.owner)
	if admitted.Code != http.StatusCreated {
		t.Fatalf("owner aiming a poll at its own ward: %d %s, want 201", admitted.Code, admitted.Body.String())
	}
	pollID, _ := decodeObject(t, admitted)["id"].(string)
	for _, g := range []string{foreignID, "made-up-group", ""} {
		if rec := w.call(t, "POST", polls, poll([]string{g}), w.owner); rec.Code < 400 || rec.Code >= 500 {
			t.Fatalf("owner aiming a poll at %s: %d %s, want 4xx", g, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "POST", polls+"/"+pollID+"/result", map[string]any{"group_ids": []string{g}}, w.owner); rec.Code < 400 || rec.Code >= 500 {
			t.Fatalf("owner publishing a result to %s: %d %s, want 4xx", g, rec.Code, rec.Body.String())
		}
	}
}
