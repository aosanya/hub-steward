package http

import (
	"context"
	"net/http"
	"testing"
	"time"

	"wakalaserver/internal/agencies"
)

func TestEventChange_ResidentCannotDoChangeOrCancelAnotherMembersEvent(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "resident-ada", agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	resident := w.cookieFor(t, "resident-ada")

	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Town hall"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)
	start := time.Now().UTC().Add(72 * time.Hour).Truncate(time.Hour)
	event := map[string]any{"kind": "event", "title": "Street cleanup", "group_ids": []string{groupID},
		"starts_at": start.Format(time.RFC3339), "ends_at": start.Add(2 * time.Hour).Format(time.RFC3339), "time_zone": "Europe/Vienna", "place": "Town hall"}
	created := w.call(t, "POST", path+"/engage/posts", event, w.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("owner posting an event: %d %s, want 201", created.Code, created.Body.String())
	}
	postID, _ := decodeObject(t, created)["id"].(string)
	if postID == "" {
		t.Fatalf("post id from create: %s", created.Body.String())
	}
	eventPath := path + "/engage/posts/" + postID

	if rec := w.call(t, "PATCH", eventPath+"/event", map[string]any{"place": "Back alley"}, resident); rec.Code < 400 {
		t.Fatalf("resident changing the owner's event: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", eventPath+"/cancelled", nil, resident); rec.Code < 400 {
		t.Fatalf("resident cancelling the owner's event: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "PATCH", eventPath+"/event", map[string]any{"place": "Library"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner changing the event: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", eventPath+"/cancelled", nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner cancelling the event: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
