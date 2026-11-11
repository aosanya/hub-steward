package http

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

func TestEngagePost_PosterCannotDoAimAtAGroupOutsideTheAgency(t *testing.T) {
	w := newStepRunWalk(t, nil)
	perms := map[string][]string{
		"role-liaison": {"volunteer_call.post"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		p, ok := perms[roleID]
		if !ok {
			return nil, errors.New("unknown role")
		}
		return p, nil
	}
	path := "/instances/" + w.instance
	subject := "agent-liaison"
	liaison := w.cookieFor(t, subject)
	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": subject}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds agent: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", path+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": "role-liaison"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner links agent: %d %s", rec.Code, rec.Body.String())
	}

	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Town hall"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)
	call := func(ids []string) map[string]any {
		return map[string]any{"kind": "volunteer_call", "title": "x", "needed_count": 3, "group_ids": ids,
			"starts_at": "2026-12-01T10:00:00Z", "ends_at": "2026-12-01T12:00:00Z", "time_zone": "Europe/Budapest", "place": "Hall"}
	}
	posts := path + "/engage/posts"

	if rec := w.call(t, "POST", posts, call([]string{"5f0c2b4e-8d1a-4c3e-9b7f-2a6d1e0c9b8a"}), liaison); rec.Code < 400 || rec.Code >= 500 {
		t.Errorf("posting to a group outside the agency: %d %s, want 4xx", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", posts, call([]string{groupID}), liaison); rec.Code != http.StatusCreated {
		t.Fatalf("posting to the agency's own group: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
