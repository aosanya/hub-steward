package http

import (
	"encoding/json"
	"net/http"
	"testing"
)

func newGroupWithApplicant(t *testing.T) (stepRunWalk, string, string, string) {
	t.Helper()
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

	rec = w.call(t, "POST", base+"/groups/"+group.ID+"/join", map[string]any{}, w.people["Liaison"])
	if rec.Code >= 400 {
		t.Fatalf("liaison asks to join the group: %d %s", rec.Code, rec.Body.String())
	}
	var joined struct {
		Request struct {
			ID string `json:"id"`
		} `json:"request"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &joined); err != nil || joined.Request.ID == "" {
		t.Fatalf("request id from join: %v %s", err, rec.Body.String())
	}
	return w, base, group.ID, joined.Request.ID
}

func TestGroupSettings_ResidentCannotDoChangeAGroupsJoinMode(t *testing.T) {
	w, base, groupID, _ := newGroupWithApplicant(t)
	path := base + "/groups/" + groupID + "/join-mode"

	if rec := w.call(t, "PUT", path, map[string]any{"join_mode": "open"}, w.people["Volunteer"]); rec.Code < 400 {
		t.Fatalf("resident changing a group's join mode: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", base+"/groups/"+groupID+"/hidden", map[string]any{"hidden": true}, w.people["Volunteer"]); rec.Code < 400 {
		t.Fatalf("resident hiding a group: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "PUT", path, map[string]any{"join_mode": "open"}, w.owner); rec.Code >= 300 {
		t.Fatalf("owner changing the group's join mode: %d %s, want success", rec.Code, rec.Body.String())
	}
}

func TestGroupSettings_ResidentCannotDoDecideAnotherResidentsGroupJoinRequest(t *testing.T) {
	w, base, _, requestID := newGroupWithApplicant(t)

	for _, action := range []string{"approve", "decline"} {
		path := base + "/join-requests/" + requestID + "/" + action
		if rec := w.call(t, "POST", path, map[string]any{}, w.people["Volunteer"]); rec.Code < 400 {
			t.Fatalf("resident calling %s on someone's group join request: %d %s, want refused", action, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "POST", path, map[string]any{}, w.people["Liaison"]); rec.Code < 400 {
			t.Fatalf("applicant calling %s on own group join request: %d %s, want refused", action, rec.Code, rec.Body.String())
		}
	}

	if rec := w.call(t, "POST", base+"/join-requests/"+requestID+"/operator-approve", map[string]any{}, w.owner); rec.Code >= 300 {
		t.Fatalf("owner approving the group join request: %d %s, want success", rec.Code, rec.Body.String())
	}
}
