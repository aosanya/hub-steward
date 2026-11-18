package routes_test

import "testing"

func repeatingBody(title, rule string) map[string]any {
	return map[string]any{
		"title":         title,
		"schedule":      map[string]any{"start": "2026-02-04T08:00:00Z", "zone": "Europe/Budapest", "rule": rule},
		"assignee_kind": "role",
		"assignee_id":   "role-3",
	}
}

func TestARepeatingTaskIsUpdatedInPlaceOverTheMux(t *testing.T) {
	h := newAccessHub(t, map[string][]string{})
	created := h.expect(201, "", "POST", "/repeating-tasks", repeatingBody("Monthly street light check", "FREQ=MONTHLY;BYMONTHDAY=1"))
	id, _ := created["id"].(string)
	if id == "" {
		t.Fatalf("no id in %v", created)
	}

	updated := h.expect(200, "", "PUT", "/repeating-tasks/"+id, repeatingBody("Fortnightly street light check", "FREQ=WEEKLY;INTERVAL=2;BYDAY=WE"))
	if updated["id"] != id || updated["title"] != "Fortnightly street light check" || updated["schedule_rule"] != "FREQ=WEEKLY;INTERVAL=2;BYDAY=WE" {
		t.Fatalf("update answered %v", updated)
	}

	h.expect(400, "", "PUT", "/repeating-tasks/"+id, repeatingBody("x", "BYDAY="))
	read := h.expect(200, "", "GET", "/repeating-tasks/"+id, nil)
	if read["title"] != "Fortnightly street light check" {
		t.Fatalf("a refused update changed the schedule: %v", read)
	}

	h.expect(404, "", "PUT", "/repeating-tasks/no-such-id", repeatingBody("y", "FREQ=DAILY"))

	h.expect(200, "", "POST", "/repeating-tasks/"+id+"/stop", nil)
	h.expect(409, "", "PUT", "/repeating-tasks/"+id, repeatingBody("z", "FREQ=DAILY"))
}
