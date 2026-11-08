package http

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestGroupInvitations_ResidentCannotDoListAGroupsInvitations(t *testing.T) {
	w := newStepRunWalk(t, referralPlan(), "Volunteer", "Liaison")
	base := "/instances/" + w.instance + "/actor"

	rec := w.call(t, "POST", base+"/groups", map[string]any{"name": "North ward"}, w.owner)
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("owner creates group: %d %s", rec.Code, rec.Body.String())
	}
	var group struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &group); err != nil || group.ID == "" {
		t.Fatalf("group id from create: %v %s", err, rec.Body.String())
	}

	listPath := base + "/groups/" + group.ID + "/invitations"
	if rec := w.call(t, "GET", listPath, nil, w.people["Volunteer"]); rec.Code < 400 {
		t.Fatalf("resident listing the group's invitations: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "GET", listPath, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner listing the group's invitations: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
