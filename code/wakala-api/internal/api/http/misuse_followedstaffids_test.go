package http

import (
	"net/http"
	"strings"
	"testing"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

func TestFollowKeyDoor_HolderReadsNoStaffMemberIds(t *testing.T) {
	w := newStepRunWalk(t, nil)
	s, err := catalog.SpecFor("followview", "reports")
	if err != nil {
		t.Fatalf("spec: %v", err)
	}
	if err := spec.Migrate(w.db, s); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	manager, err := catalog.NewCatalogManager(w.db, s)
	if err != nil {
		t.Fatalf("manager: %v", err)
	}
	w.deps.Catalog = manager
	w.deps.Permissions = everyoneMay{}
	w.handler = NewRouter(w.deps)

	rec := w.call(t, "POST", "/catalog/raised-items/filed", map[string]any{"title": "Broken street lamp", "topic": "Lighting", "raised_by": "resident-1", "channel": "phone", "publishable": true}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("staff files the item: %d %s", rec.Code, rec.Body.String())
	}
	itemID, _ := decodeObject(t, rec)["id"].(string)

	if rec := w.call(t, "POST", "/catalog/raised-items/"+itemID+"/replies", map[string]any{"body": "A crew is booked for Tuesday"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("staff replies: %d %s", rec.Code, rec.Body.String())
	}
	issued := w.call(t, "POST", "/catalog/raised-items/"+itemID+"/follow-key", nil, w.owner)
	if issued.Code >= 400 {
		t.Fatalf("staff issues the follow key: %d %s", issued.Code, issued.Body.String())
	}
	key, _ := decodeObject(t, issued)["key"].(string)
	if key == "" {
		t.Fatalf("no follow key issued: %s", issued.Body.String())
	}

	staffReplies := w.call(t, "GET", "/catalog/raised-items/"+itemID+"/replies", nil, w.owner)
	if staffReplies.Code != http.StatusOK || !strings.Contains(staffReplies.Body.String(), "replied_by") || !strings.Contains(staffReplies.Body.String(), "test-owner") {
		t.Fatalf("staff read of the replies no longer names who replied: %d %s", staffReplies.Code, staffReplies.Body.String())
	}
	resident := w.cookieFor(t, "resident-1")
	mine := w.call(t, "GET", "/catalog/raised-items/mine", nil, resident)
	if mine.Code != http.StatusOK || !strings.Contains(mine.Body.String(), `"filed_by":"test-owner"`) {
		t.Fatalf("resident's own list no longer holds filed_by: %d %s", mine.Code, mine.Body.String())
	}

	door := getWithHeaders(w, "/catalog/followed-items/"+key, "", nil)
	if door.Code != http.StatusOK {
		t.Fatalf("holder opens the followed item: %d %s", door.Code, door.Body.String())
	}
	if strings.Contains(door.Body.String(), "test-owner") {
		t.Fatalf("holder's body names the staff member test-owner: %s", door.Body.String())
	}

	opened := decodeObject(t, door)
	item, _ := opened["item"].(map[string]any)
	for _, field := range []string{"filed_by", "department_by", "raised_by", "channel", "subject_id", "board_item_id", "area_mismatch"} {
		if _, held := item[field]; held {
			t.Fatalf("holder's item holds %s: %s", field, door.Body.String())
		}
	}
	replies, _ := opened["replies"].([]any)
	if len(replies) != 1 {
		t.Fatalf("holder reads %d replies, want 1: %s", len(replies), door.Body.String())
	}
	reply, _ := replies[0].(map[string]any)
	if _, held := reply["replied_by"]; held {
		t.Fatalf("holder's reply holds replied_by: %s", door.Body.String())
	}
	if reply["body"] != "A crew is booked for Tuesday" {
		t.Fatalf("holder no longer reads the reply text: %s", door.Body.String())
	}
	if item["title"] != "Broken street lamp" || item["id"] != itemID {
		t.Fatalf("holder no longer reads the title and id: %s", door.Body.String())
	}
	if opened["status"] != catalog.StatusReceived {
		t.Fatalf("holder no longer reads the status: %s", door.Body.String())
	}
}
