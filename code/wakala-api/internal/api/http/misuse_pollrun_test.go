package http

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

func TestPollRun_CommsOfficerCannotDoRunPoll(t *testing.T) {
	w := newStepRunWalk(t, nil)
	perms := map[string][]string{
		"role-comms":    {"report.publish", "notice.post"},
		"role-mediator": {"form.approve", "poll.run"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		p, ok := perms[roleID]
		if !ok {
			return nil, errors.New("unknown role")
		}
		return p, nil
	}
	path := "/instances/" + w.instance

	agent := func(subject, roleID string) *http.Cookie {
		c := w.cookieFor(t, subject)
		if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": subject}, w.owner); rec.Code != http.StatusCreated {
			t.Fatalf("owner adds agent %s: %d %s", subject, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "PUT", path+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": roleID}, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("owner links %s to %s: %d %s", subject, roleID, rec.Code, rec.Body.String())
		}
		return c
	}
	comms := agent("agent-comms", "role-comms")
	mediator := agent("agent-mediator", "role-mediator")

	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Town hall"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)

	poll := map[string]any{"question": "Close Mill Row on Sundays?", "choices": []map[string]any{{"label": "yes"}, {"label": "no"}},
		"opens_at": "2026-11-08T00:00:00Z", "closes_at": "2026-12-08T00:00:00Z", "group_ids": []string{groupID}}
	polls := path + "/voting/polls"

	if rec := w.call(t, "POST", polls, poll, comms); rec.Code != http.StatusForbidden {
		t.Fatalf("comms officer running a poll: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", polls, poll, mediator); rec.Code != http.StatusCreated {
		t.Fatalf("mediator running a poll: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
