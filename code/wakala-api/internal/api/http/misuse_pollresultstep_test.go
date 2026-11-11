package http

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"
)

func TestPollResult_CommsOfficerCanDoPublishResult(t *testing.T) {
	w := newStepRunWalk(t, nil)
	perms := map[string][]string{
		"role-mediator": {"form.approve", "poll.run"},
		"role-comms":    {"report.publish", "notice.post"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		p, ok := perms[roleID]
		if !ok {
			return nil, errors.New("unknown role")
		}
		return p, nil
	}
	path := "/instances/" + w.instance
	mediator := w.cookieFor(t, "agent-mediator")
	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": "agent-mediator"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds agent: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", path+"/members/agent-mediator/agency-role", map[string]any{"agency_role_id": "role-mediator"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner links agent: %d %s", rec.Code, rec.Body.String())
	}
	comms := w.cookieFor(t, "agent-comms")
	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": "agent-comms"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds agent: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", path+"/members/agent-comms/agency-role", map[string]any{"agency_role_id": "role-comms"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner links agent: %d %s", rec.Code, rec.Body.String())
	}
	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Town hall"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)

	closes := time.Now().UTC().Add(2 * time.Second).Format(time.RFC3339)
	poll := map[string]any{"question": "Close Mill Row on Sundays?", "mode": "one", "per_group": "once",
		"choices":  []map[string]any{{"label": "yes"}, {"label": "no"}},
		"opens_at": "2026-01-01T00:00:00Z", "closes_at": closes, "group_ids": []string{groupID}}
	rec := w.call(t, "POST", path+"/voting/polls", poll, mediator)
	if rec.Code != http.StatusCreated {
		t.Fatalf("mediator running a poll: %d %s", rec.Code, rec.Body.String())
	}
	pollID, _ := decodeObject(t, rec)["id"].(string)
	time.Sleep(3 * time.Second)

	result := path + "/voting/polls/" + pollID + "/result"
	publish := map[string]any{"group_ids": []string{groupID}}
	if rec := w.call(t, "POST", result, publish, comms); rec.Code != http.StatusOK {
		t.Fatalf("comms officer publishing a poll result: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
