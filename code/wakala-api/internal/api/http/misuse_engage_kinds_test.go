package http

import "testing"

func TestEngagePostKinds_EventHolderCannotPostNotice(t *testing.T) {
	notice := allowedActions([]string{"notice.post"})
	event := allowedActions([]string{"event.post"})
	call := allowedActions([]string{"volunteer_call.post"})
	shared := 0
	for a := range notice {
		if event[a] || call[a] {
			shared++
			t.Errorf("notice.post and event.post or volunteer_call.post both admit %q, so a holder of one kind may post every kind", a)
		}
	}
	if len(notice) == 0 || len(event) == 0 || len(call) == 0 {
		t.Fatalf("each post kind permission must admit its own action")
	}
}
