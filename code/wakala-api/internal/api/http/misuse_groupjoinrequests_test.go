package http

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestGroupJoinRequests_ResidentCannotDoListAGroupsJoinRequests(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer", "Liaison")
	base := "/instances/" + w.instance + "/actor"

	rec := w.call(t, "POST", base+"/groups", map[string]any{"name": "Kertváros"}, w.owner)
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("owner creates group: %d %s", rec.Code, rec.Body.String())
	}
	var group struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &group); err != nil || group.ID == "" {
		t.Fatalf("group id from create: %v %s", err, rec.Body.String())
	}

	applicant := w.people["Liaison"]
	if rec := w.call(t, "POST", base+"/groups/"+group.ID+"/join", map[string]any{}, applicant); rec.Code >= 400 {
		t.Fatalf("applicant asks to join the group: %d %s", rec.Code, rec.Body.String())
	}

	listPath := base + "/groups/" + group.ID + "/join-requests"
	if rec := w.call(t, "GET", listPath, nil, w.people["Volunteer"]); rec.Code < 400 {
		t.Fatalf("resident listing the group's join requests: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "GET", listPath, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner listing the group's join requests: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
