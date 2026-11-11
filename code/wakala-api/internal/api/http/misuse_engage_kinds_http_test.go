package http

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

func TestPosts_EachPostPermissionAdmitsOnlyItsOwnKind(t *testing.T) {
	w := newStepRunWalk(t, nil)
	perms := map[string][]string{
		"role-notice":  {"notice.post"},
		"role-liaison": {"event.post", "volunteer_call.post"},
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
	noticeHolder := agent("agent-notice", "role-notice")
	liaison := agent("agent-liaison", "role-liaison")

	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Town hall"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)
	groups := []string{groupID}
	notice := map[string]any{"kind": "notice", "title": "Road closed", "body": "synthetic", "group_ids": groups}
	event := map[string]any{"kind": "event", "title": "Street cleanup", "group_ids": groups,
		"starts_at": "2026-12-01T10:00:00Z", "ends_at": "2026-12-01T12:00:00Z", "time_zone": "Europe/Budapest", "place": "Town hall"}
	call := map[string]any{"kind": "volunteer_call", "title": "Help", "group_ids": groups, "needed_count": 2,
		"starts_at": "2026-12-01T10:00:00Z", "time_zone": "Europe/Budapest"}
	posts := path + "/engage/posts"

	cases := []struct {
		name string
		as   *http.Cookie
		body map[string]any
		want int
	}{
		{"notice holder posts a notice", noticeHolder, notice, http.StatusCreated},
		{"notice holder posts an event", noticeHolder, event, http.StatusForbidden},
		{"notice holder posts a volunteer call", noticeHolder, call, http.StatusForbidden},
		{"liaison posts an event", liaison, event, http.StatusCreated},
		{"liaison posts a volunteer call", liaison, call, http.StatusCreated},
		{"liaison posts a notice", liaison, notice, http.StatusForbidden},
		{"liaison posts a post of no known kind", liaison, map[string]any{"kind": "rumour", "title": "x", "group_ids": groups}, http.StatusForbidden},
		{"owner posts a notice", w.owner, notice, http.StatusCreated},
	}
	for _, c := range cases {
		if rec := w.call(t, "POST", posts, c.body, c.as); rec.Code != c.want {
			t.Errorf("%s: %d %s, want %d", c.name, rec.Code, rec.Body.String(), c.want)
		}
	}
}
