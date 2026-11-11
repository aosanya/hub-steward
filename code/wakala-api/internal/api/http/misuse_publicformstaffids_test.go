package http

import (
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestPublicFormDoor_StrangerReadsNoStaffMemberIds(t *testing.T) {
	w := newStepRunWalk(t, nil)
	forms := "/instances/" + w.instance + "/forms"
	closes := time.Now().Add(72 * time.Hour).UTC().Format(time.RFC3339)

	rec := w.call(t, "POST", forms+"/forms", map[string]any{"title": "Street lighting survey", "audience": "public", "closes_at": closes}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("owner creates the form: %d %s", rec.Code, rec.Body.String())
	}
	formID, _ := decodeObject(t, rec)["id"].(string)
	if rec := w.call(t, "POST", forms+"/forms/"+formID+"/publish", map[string]any{"candidate_link_key": "street-lighting-key"}, w.owner); rec.Code >= 400 {
		t.Fatalf("owner publishes the form: %d %s", rec.Code, rec.Body.String())
	}

	staff := w.call(t, "GET", forms+"/forms/"+formID, nil, w.owner)
	if staff.Code != http.StatusOK {
		t.Fatalf("owner reads the form: %d %s", staff.Code, staff.Body.String())
	}
	staffForm := decodeObject(t, staff)
	ownerID, _ := staffForm["created_by"].(string)
	if ownerID == "" {
		t.Fatalf("staff read no longer holds created_by: %s", staff.Body.String())
	}
	if staffForm["published_by"] != ownerID {
		t.Fatalf("staff read no longer holds published_by: %s", staff.Body.String())
	}

	door := getWithHeaders(w, forms+"/public-links/street-lighting-key", "", nil)
	if door.Code != http.StatusOK {
		t.Fatalf("stranger opens the public link: %d %s", door.Code, door.Body.String())
	}
	if strings.Contains(door.Body.String(), ownerID) {
		t.Fatalf("stranger's body holds the staff member id %s: %s", ownerID, door.Body.String())
	}

	opened := decodeObject(t, door)
	form, _ := opened["form"].(map[string]any)
	link, _ := opened["link"].(map[string]any)
	for _, field := range []string{"created_by", "published_by", "closed_by", "submitted_by", "approved_by", "originator_chapter_id"} {
		if _, held := form[field]; held {
			t.Fatalf("stranger's form holds %s: %s", field, door.Body.String())
		}
	}
	if _, held := link["created_by"]; held {
		t.Fatalf("stranger's link holds created_by: %s", door.Body.String())
	}

	if form["title"] != "Street lighting survey" || form["status"] != "open" || form["closes_at"] == "" || form["id"] != formID {
		t.Fatalf("respondent no longer gets title, status, window and id: %s", door.Body.String())
	}
	if link["key"] != "street-lighting-key" {
		t.Fatalf("respondent no longer gets the link key: %s", door.Body.String())
	}
	if agency, _ := opened["agency"].(map[string]any); agency["name"] != "Health program" {
		t.Fatalf("respondent no longer gets the agency name: %s", door.Body.String())
	}
}
