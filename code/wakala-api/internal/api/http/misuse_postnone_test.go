package http

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

func TestPosts_AnalystWithoutPermissionsCannotDoPostEvent(t *testing.T) {
	w := newStepRunWalk(t, nil)
	perms := map[string][]string{
		"role-analyst": {},
		"role-liaison": {"member.invite", "event.post", "volunteer_call.post"},
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
	analyst := agent("agent-analyst", "role-analyst")
	liaison := agent("agent-liaison", "role-liaison")

	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Town hall"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)
	event := map[string]any{"kind": "event", "title": "Street cleanup", "group_ids": []string{groupID},
		"starts_at": "2026-12-01T10:00:00Z", "ends_at": "2026-12-01T12:00:00Z", "time_zone": "Europe/Budapest", "place": "Town hall"}
	posts := path + "/engage/posts"

	if rec := w.call(t, "POST", posts, event, analyst); rec.Code != http.StatusForbidden {
		t.Fatalf("analyst posting an event: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", posts, event, liaison); rec.Code != http.StatusCreated {
		t.Fatalf("liaison posting an event: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
