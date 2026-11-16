package routes

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestTheCouncilUpdateOperationsBecomeThreeTools(t *testing.T) {
	want := map[string]string{
		"council_meeting_update":    "council.meeting.update",
		"council_resolution_update": "council.resolution.update",
		"council_bylaw_update":      "council.bylaw.update",
	}
	byName := map[string]string{}
	for _, tl := range Tools(newManager(t)) {
		byName[tl.Name] = tl.Action
	}
	for name, action := range want {
		if byName[name] != action {
			t.Errorf("%s has action %q, want %q", name, byName[name], action)
		}
	}
}

func TestAMeetingIsCorrectedAndReadBackWithItsIdAndCreationKept(t *testing.T) {
	cm := newManager(t)
	id := newMeeting(t, cm, "town-1")

	out, err := call(t, tool(t, cm, "council_meeting_update"),
		`{"instance_id":"town-1","meetingID":"`+id+`","name":"Budget session, moved","date":"2026-12-10","place":"Library","committee":"Finance"}`)
	if err != nil {
		t.Fatal(err)
	}
	var got meetingRow
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != id || got.Name != "Budget session, moved" || got.Date != "2026-12-10" || got.Place != "Library" {
		t.Fatalf("updated meeting = %+v", got)
	}
	read, err := call(t, tool(t, cm, "council_meeting_read"), `{"instance_id":"town-1","meetingID":"`+id+`"}`)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(read), "Budget session, moved") {
		t.Errorf("read back %s, want the corrected name", read)
	}
}

func TestAMeetingOfAnotherAgencyCannotBeUpdated(t *testing.T) {
	cm := newManager(t)
	id := newMeeting(t, cm, "town-1")

	_, err := call(t, tool(t, cm, "council_meeting_update"),
		`{"instance_id":"town-2","meetingID":"`+id+`","name":"Hijacked","date":"2026-12-10"}`)
	if err == nil {
		t.Fatal("another agency updated the meeting, want a refusal")
	}
	read, _ := call(t, tool(t, cm, "council_meeting_read"), `{"instance_id":"town-1","meetingID":"`+id+`"}`)
	if strings.Contains(string(read), "Hijacked") {
		t.Errorf("meeting changed by another agency: %s", read)
	}
}

func TestAMeetingUpdateRefusesABlankNameAndABadDate(t *testing.T) {
	cm := newManager(t)
	id := newMeeting(t, cm, "town-1")
	for _, args := range []string{
		`{"instance_id":"town-1","meetingID":"` + id + `","name":"  ","date":"2026-12-10"}`,
		`{"instance_id":"town-1","meetingID":"` + id + `","name":"Session","date":"10/12/2026"}`,
		`{"instance_id":"town-1","meetingID":"missing","name":"Session","date":"2026-12-10"}`,
	} {
		if _, err := call(t, tool(t, cm, "council_meeting_update"), args); err == nil {
			t.Errorf("update %s succeeded, want a refusal", args)
		}
	}
}

func TestAResolutionOutcomeAndTitleAreCorrectedButNotItsMeeting(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	made := newResolution(t, cm, `{"instance_id":"town-1","title":"Adopt the budget","date":"2026-12-03","outcome":"deferred","meeting_id":"`+meeting+`"}`)

	out, err := call(t, tool(t, cm, "council_resolution_update"),
		`{"instance_id":"town-1","resolutionID":"`+made.ID+`","title":"Adopt the 2027 budget","date":"2026-12-03","outcome":"adopted"}`)
	if err != nil {
		t.Fatal(err)
	}
	var got resolutionRow
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	if got.Title != "Adopt the 2027 budget" || got.Outcome != "adopted" || got.MeetingID != meeting {
		t.Fatalf("updated resolution = %+v, want the new title and outcome and the old meeting %s", got, meeting)
	}
}

func TestAResolutionCannotBeMovedToAnotherMeetingByUpdate(t *testing.T) {
	cm := newManager(t)
	made := newResolution(t, cm, `{"instance_id":"town-1","title":"Adopt the budget","date":"2026-12-03","outcome":"deferred"}`)

	if _, err := call(t, tool(t, cm, "council_resolution_update"),
		`{"instance_id":"town-1","resolutionID":"`+made.ID+`","title":"Adopt the budget","date":"2026-12-03","outcome":"adopted","meeting_id":"other"}`); err == nil {
		t.Error("the meeting of a resolution was changed by an update")
	}
}

func TestAResolutionUpdateRefusesAnUnknownOutcomeAndAnotherAgency(t *testing.T) {
	cm := newManager(t)
	made := newResolution(t, cm, `{"instance_id":"town-1","title":"Adopt the budget","date":"2026-12-03","outcome":"deferred"}`)

	if _, err := call(t, tool(t, cm, "council_resolution_update"),
		`{"instance_id":"town-1","resolutionID":"`+made.ID+`","title":"Adopt the budget","date":"2026-12-03","outcome":"maybe"}`); err == nil {
		t.Error("an unknown outcome was accepted")
	}
	if _, err := call(t, tool(t, cm, "council_resolution_update"),
		`{"instance_id":"town-2","resolutionID":"`+made.ID+`","title":"Hijacked","date":"2026-12-03","outcome":"adopted"}`); err == nil {
		t.Error("another agency updated the resolution")
	}
}

func TestABylawTextAndYearAreCorrectedAndAnotherAgencyIsRefused(t *testing.T) {
	cm := newManager(t)
	made := newBylaw(t, cm, "town-1", "Market hours", 2024, "Stalls open at six.")

	out, err := call(t, tool(t, cm, "council_bylaw_update"),
		`{"instance_id":"town-1","bylawID":"`+made.ID+`","title":"Market hours","year":2025,"text":"Stalls open at seven."}`)
	if err != nil {
		t.Fatal(err)
	}
	var got bylawRow
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != made.ID || got.Year != 2025 || got.Text != "Stalls open at seven." || got.CreatedAt != made.CreatedAt {
		t.Fatalf("updated bylaw = %+v", got)
	}
	if _, err := call(t, tool(t, cm, "council_bylaw_update"),
		`{"instance_id":"town-2","bylawID":"`+made.ID+`","title":"x","year":2025,"text":"y"}`); err == nil {
		t.Error("another agency updated the bylaw")
	}
	if _, err := call(t, tool(t, cm, "council_bylaw_update"),
		`{"instance_id":"town-1","bylawID":"`+made.ID+`","title":"Market hours","year":99,"text":"y"}`); err == nil {
		t.Error("a two-digit year was accepted")
	}
}
