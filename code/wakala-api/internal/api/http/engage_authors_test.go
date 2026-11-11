package http

import (
	"net/http"
	"testing"
	"time"
)

func TestEngageAuthorFieldsInTheBodyAreIgnoredByTheMount(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance
	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Town hall"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)
	start := time.Now().UTC().Add(72 * time.Hour).Truncate(time.Hour)
	event := map[string]any{"kind": "event", "title": "Street cleanup", "group_ids": []string{groupID}, "posted_by": "forged-clerk",
		"starts_at": start.Format(time.RFC3339), "ends_at": start.Add(2 * time.Hour).Format(time.RFC3339), "time_zone": "Europe/Vienna", "place": "Town hall"}
	created := w.call(t, "POST", path+"/engage/posts", event, w.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("owner posting an event: %d %s, want 201", created.Code, created.Body.String())
	}
	post := decodeObject(t, created)
	if post["posted_by"] != "test-owner" {
		t.Errorf("the post names %v as its poster, want the session's test-owner, never the body's forged-clerk", post["posted_by"])
	}

	changed := w.call(t, "PATCH", path+"/engage/posts/"+post["id"].(string)+"/event", map[string]any{"place": "Library", "changed_by": "forged-clerk"}, w.owner)
	if changed.Code != http.StatusOK {
		t.Errorf("owner changing the event with a forged changed_by in the body: %d %s, want 200", changed.Code, changed.Body.String())
	}
}
