package routes

import (
	"encoding/json"
	"strings"
	"testing"

	council "wakalaserver/modules/council"
)

type agendaRow struct {
	ID        string   `json:"id"`
	MeetingID string   `json:"meeting_id"`
	Items     []string `json:"items"`
}

type minutesRow struct {
	ID        string `json:"id"`
	MeetingID string `json:"meeting_id"`
	Text      string `json:"text"`
}

func newMeeting(t *testing.T, cm council.CouncilManager, agency string) string {
	t.Helper()
	out, err := call(t, tool(t, cm, "council_meeting_create"),
		`{"instance_id":"`+agency+`","name":"Budget session","date":"2026-12-03"}`)
	if err != nil {
		t.Fatal(err)
	}
	var made meetingRow
	if err := json.Unmarshal(out, &made); err != nil || made.ID == "" {
		t.Fatalf("meeting = %s, %v", out, err)
	}
	return made.ID
}

func TestTheAgendaAndMinutesOperationsBecomeFourTools(t *testing.T) {
	want := map[string]string{
		"council_agenda_set":   "council.agenda.set",
		"council_agenda_read":  "council.agenda.read",
		"council_minutes_set":  "council.minutes.set",
		"council_minutes_read": "council.minutes.read",
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

func TestAnAgendaSetForAMeetingIsReadBackItemForItem(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")

	if _, err := call(t, tool(t, cm, "council_agenda_set"),
		`{"instance_id":"town-1","meetingID":"`+meeting+`","items":["Opening"," Budget 2027 ","Any other business"]}`); err != nil {
		t.Fatal(err)
	}
	read, err := call(t, tool(t, cm, "council_agenda_read"), `{"instance_id":"town-1","meetingID":"`+meeting+`"}`)
	if err != nil {
		t.Fatal(err)
	}

	var got agendaRow
	if err := json.Unmarshal(read, &got); err != nil {
		t.Fatalf("%s: %v", read, err)
	}
	if got.MeetingID != meeting || strings.Join(got.Items, "|") != "Opening|Budget 2027|Any other business" {
		t.Fatalf("agenda = %+v", got)
	}
}

func TestSettingTheAgendaAgainReplacesTheItemsAndKeepsOneRow(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	set := tool(t, cm, "council_agenda_set")

	first, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","items":["Old"]}`)
	if err != nil {
		t.Fatal(err)
	}
	second, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","items":["New one","New two"]}`)
	if err != nil {
		t.Fatal(err)
	}

	var a, b agendaRow
	if err := json.Unmarshal(first, &a); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(second, &b); err != nil {
		t.Fatal(err)
	}
	if a.ID != b.ID {
		t.Errorf("second set made a new row: %s then %s", a.ID, b.ID)
	}
	read, err := call(t, tool(t, cm, "council_agenda_read"), `{"instance_id":"town-1","meetingID":"`+meeting+`"}`)
	if err != nil {
		t.Fatal(err)
	}
	var got agendaRow
	if err := json.Unmarshal(read, &got); err != nil {
		t.Fatal(err)
	}
	if strings.Join(got.Items, "|") != "New one|New two" {
		t.Fatalf("items = %v", got.Items)
	}
}

func TestAnotherAgencyCannotReadTheAgendaOrSetOneOnTheMeeting(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	if _, err := call(t, tool(t, cm, "council_agenda_set"),
		`{"instance_id":"town-1","meetingID":"`+meeting+`","items":["Private matter"]}`); err != nil {
		t.Fatal(err)
	}

	if _, err := call(t, tool(t, cm, "council_agenda_read"), `{"instance_id":"town-2","meetingID":"`+meeting+`"}`); err == nil {
		t.Error("agency town-2 read the agenda of town-1")
	}
	if _, err := call(t, tool(t, cm, "council_agenda_set"),
		`{"instance_id":"town-2","meetingID":"`+meeting+`","items":["Hijack"]}`); err == nil {
		t.Error("agency town-2 set an agenda on the meeting of town-1")
	}
}

func TestAnAgendaNeedsAtLeastOneNonBlankItem(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	set := tool(t, cm, "council_agenda_set")
	for name, body := range map[string]string{
		"no items":   `{"instance_id":"town-1","meetingID":"` + meeting + `","items":[]}`,
		"blank item": `{"instance_id":"town-1","meetingID":"` + meeting + `","items":["Opening","  "]}`,
		"no agency":  `{"meetingID":"` + meeting + `","items":["Opening"]}`,
		"no meeting": `{"instance_id":"town-1","meetingID":"missing","items":["Opening"]}`,
	} {
		if _, err := call(t, set, body); err == nil {
			t.Errorf("%s: the agenda was accepted", name)
		}
	}
}

func TestReadingAnAgendaNeverSetIsRefused(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")

	if _, err := call(t, tool(t, cm, "council_agenda_read"), `{"instance_id":"town-1","meetingID":"`+meeting+`"}`); err == nil {
		t.Fatal("an agenda that was never set was read")
	}
}

func TestMinutesSetForAMeetingAreReadBackAndReplacedOnTheNextSet(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	set := tool(t, cm, "council_minutes_set")

	first, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","text":"Draft minutes."}`)
	if err != nil {
		t.Fatal(err)
	}
	second, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","text":"  Adopted minutes.  "}`)
	if err != nil {
		t.Fatal(err)
	}
	var a, b minutesRow
	if err := json.Unmarshal(first, &a); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(second, &b); err != nil {
		t.Fatal(err)
	}
	if a.ID != b.ID {
		t.Errorf("second set made a new row: %s then %s", a.ID, b.ID)
	}

	read, err := call(t, tool(t, cm, "council_minutes_read"), `{"instance_id":"town-1","meetingID":"`+meeting+`"}`)
	if err != nil {
		t.Fatal(err)
	}
	var got minutesRow
	if err := json.Unmarshal(read, &got); err != nil {
		t.Fatal(err)
	}
	if got.MeetingID != meeting || got.Text != "Adopted minutes." {
		t.Fatalf("minutes = %+v", got)
	}
}

func TestAnotherAgencyCannotReadTheMinutesOrSetThemOnTheMeeting(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	if _, err := call(t, tool(t, cm, "council_minutes_set"),
		`{"instance_id":"town-1","meetingID":"`+meeting+`","text":"Closed session."}`); err != nil {
		t.Fatal(err)
	}

	if _, err := call(t, tool(t, cm, "council_minutes_read"), `{"instance_id":"town-2","meetingID":"`+meeting+`"}`); err == nil {
		t.Error("agency town-2 read the minutes of town-1")
	}
	if _, err := call(t, tool(t, cm, "council_minutes_set"),
		`{"instance_id":"town-2","meetingID":"`+meeting+`","text":"Hijack"}`); err == nil {
		t.Error("agency town-2 set minutes on the meeting of town-1")
	}
}

func TestMinutesNeedTextAndAMeetingThatExists(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	set := tool(t, cm, "council_minutes_set")
	for name, body := range map[string]string{
		"blank text": `{"instance_id":"town-1","meetingID":"` + meeting + `","text":"   "}`,
		"no agency":  `{"meetingID":"` + meeting + `","text":"Minutes"}`,
		"no meeting": `{"instance_id":"town-1","meetingID":"missing","text":"Minutes"}`,
	} {
		if _, err := call(t, set, body); err == nil {
			t.Errorf("%s: the minutes were accepted", name)
		}
	}
	if _, err := call(t, tool(t, cm, "council_minutes_read"), `{"instance_id":"town-1","meetingID":"`+meeting+`"}`); err == nil {
		t.Error("minutes never set were read")
	}
}
