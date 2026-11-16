package routes

import (
	"encoding/json"
	"strings"
	"testing"

	council "wakalaserver/modules/council"
)

type resolutionRow struct {
	ID        string `json:"id"`
	MeetingID string `json:"meeting_id"`
	Title     string `json:"title"`
	Date      string `json:"date"`
	Outcome   string `json:"outcome"`
}

func newResolution(t *testing.T, cm council.CouncilManager, args string) resolutionRow {
	t.Helper()
	out, err := call(t, tool(t, cm, "council_resolution_create"), args)
	if err != nil {
		t.Fatal(err)
	}
	var made resolutionRow
	if err := json.Unmarshal(out, &made); err != nil || made.ID == "" {
		t.Fatalf("resolution = %s, %v", out, err)
	}
	return made
}

func TestTheResolutionOperationsBecomeThreeTools(t *testing.T) {
	want := map[string]string{
		"council_resolution_create": "council.resolution.create",
		"council_resolution_list":   "council.resolution.list",
		"council_resolution_read":   "council.resolution.read",
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

func TestACreatedResolutionIsReadBackWithTitleDateOutcomeAndMeeting(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	made := newResolution(t, cm,
		`{"instance_id":"town-1","title":"  Adopt the 2027 budget ","date":"2026-12-03","outcome":"adopted","meeting_id":"`+meeting+`"}`)

	out, err := call(t, tool(t, cm, "council_resolution_read"),
		`{"instance_id":"town-1","resolutionID":"`+made.ID+`"}`)
	if err != nil {
		t.Fatal(err)
	}
	var got resolutionRow
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	want := resolutionRow{ID: made.ID, MeetingID: meeting, Title: "Adopt the 2027 budget", Date: "2026-12-03", Outcome: "adopted"}
	if got != want {
		t.Errorf("read = %+v, want %+v", got, want)
	}
}

func TestAResolutionNeedNotNameAMeeting(t *testing.T) {
	cm := newManager(t)
	made := newResolution(t, cm, `{"instance_id":"town-1","title":"Close Mill Street","date":"2026-11-02","outcome":"deferred"}`)
	if made.MeetingID != "" {
		t.Errorf("meeting_id = %q, want empty", made.MeetingID)
	}
}

func TestResolutionListIsEarliestDayFirstAndNarrowedByAgencyMeetingAndOutcome(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	newResolution(t, cm, `{"instance_id":"town-1","title":"Late","date":"2026-12-10","outcome":"adopted","meeting_id":"`+meeting+`"}`)
	newResolution(t, cm, `{"instance_id":"town-1","title":"Early","date":"2026-11-01","outcome":"rejected"}`)
	newResolution(t, cm, `{"instance_id":"town-2","title":"Elsewhere","date":"2026-11-05","outcome":"adopted"}`)

	titles := func(args string) string {
		out, err := call(t, tool(t, cm, "council_resolution_list"), args)
		if err != nil {
			t.Fatal(err)
		}
		var rows []resolutionRow
		if err := json.Unmarshal(out, &rows); err != nil {
			t.Fatal(err)
		}
		names := make([]string, len(rows))
		for i, r := range rows {
			names[i] = r.Title
		}
		return strings.Join(names, ",")
	}

	if got := titles(`{"instance_id":"town-1"}`); got != "Early,Late" {
		t.Errorf("list = %q, want Early,Late", got)
	}
	if got := titles(`{"instance_id":"town-1","meeting_id":"` + meeting + `"}`); got != "Late" {
		t.Errorf("by meeting = %q, want Late", got)
	}
	if got := titles(`{"instance_id":"town-1","outcome":"rejected"}`); got != "Early" {
		t.Errorf("by outcome = %q, want Early", got)
	}
	if got := titles(`{"instance_id":"town-2"}`); got != "Elsewhere" {
		t.Errorf("other agency = %q, want Elsewhere", got)
	}
}

func TestAnotherAgencyCannotReadTheResolutionOrAttachOneToTheMeeting(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	made := newResolution(t, cm, `{"instance_id":"town-1","title":"Adopt","date":"2026-12-03","outcome":"adopted"}`)

	if _, err := call(t, tool(t, cm, "council_resolution_read"),
		`{"instance_id":"town-2","resolutionID":"`+made.ID+`"}`); err == nil || !strings.Contains(err.Error(), "not found") {
		t.Errorf("read by another agency err = %v, want not found", err)
	}
	if _, err := call(t, tool(t, cm, "council_resolution_create"),
		`{"instance_id":"town-2","title":"Adopt","date":"2026-12-03","outcome":"adopted","meeting_id":"`+meeting+`"}`); err == nil || !strings.Contains(err.Error(), "not found") {
		t.Errorf("create on another agency's meeting err = %v, want not found", err)
	}
}

func TestCreateRefusesBlankTitleBadDateAndUnknownOutcome(t *testing.T) {
	cm := newManager(t)
	for name, args := range map[string]string{
		"blank title":     `{"instance_id":"town-1","title":"  ","date":"2026-12-03","outcome":"adopted"}`,
		"bad date":        `{"instance_id":"town-1","title":"Adopt","date":"3 Dec","outcome":"adopted"}`,
		"no outcome":      `{"instance_id":"town-1","title":"Adopt","date":"2026-12-03"}`,
		"unknown outcome": `{"instance_id":"town-1","title":"Adopt","date":"2026-12-03","outcome":"maybe"}`,
		"no agency":       `{"title":"Adopt","date":"2026-12-03","outcome":"adopted"}`,
	} {
		if _, err := call(t, tool(t, cm, "council_resolution_create"), args); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestResolutionListAndReadNeedTheAgencyAndAKnownId(t *testing.T) {
	cm := newManager(t)
	if _, err := call(t, tool(t, cm, "council_resolution_list"), `{}`); err == nil {
		t.Error("list without an agency accepted")
	}
	if _, err := call(t, tool(t, cm, "council_resolution_read"), `{"instance_id":"town-1","resolutionID":"nope"}`); err == nil {
		t.Error("read of an unknown id accepted")
	}
}
