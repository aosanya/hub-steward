package routes

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	council "wakalaserver/modules/council"
)

func newManager(t *testing.T) council.CouncilManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := council.SpecFor("routes")
	if err != nil {
		t.Fatal(err)
	}
	if err := council.Provision(db, s); err != nil {
		t.Fatal(err)
	}
	cm, err := council.NewCouncilManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return cm
}

func tool(t *testing.T, cm council.CouncilManager, name string) Tool {
	t.Helper()
	for _, tl := range Tools(cm) {
		if tl.Name == name {
			return tl
		}
	}
	t.Fatalf("no tool %s", name)
	return Tool{}
}

type meetingRow struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Date      string `json:"date"`
	Place     string `json:"place"`
	Committee string `json:"committee"`
}

func call(t *testing.T, tl Tool, args string) (json.RawMessage, error) {
	t.Helper()
	out, err := tl.Invoke(context.Background(), json.RawMessage(args))
	if err != nil {
		return nil, err
	}
	encoded, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	return encoded, nil
}

func TestTheDeclaredOperationsBecomeTheThreeCouncilMeetingTools(t *testing.T) {
	want := map[string]string{
		"council_meeting_create": "council.meeting.create",
		"council_meeting_list":   "council.meeting.list",
		"council_meeting_read":   "council.meeting.read",
	}
	tools := Tools(newManager(t))

	if len(tools) != len(want) {
		t.Fatalf("tools = %d, want %d", len(tools), len(want))
	}
	for _, tl := range tools {
		if want[tl.Name] != tl.Action {
			t.Errorf("%s has action %q, want %q", tl.Name, tl.Action, want[tl.Name])
		}
	}
}

func TestShapeIsPostListAndGetRoutes(t *testing.T) {
	var got []string
	for _, r := range Shape() {
		got = append(got, r.Method+" "+r.Path)
	}

	want := "GET /council/meetings,GET /council/meetings/{meetingID},POST /council/meetings"
	if strings.Join(sorted(got), ",") != want {
		t.Fatalf("shape = %v", got)
	}
}

func sorted(in []string) []string {
	out := append([]string(nil), in...)
	for i := range out {
		for j := i + 1; j < len(out); j++ {
			if out[j] < out[i] {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	return out
}

func TestCreatedMeetingIsReadBackWithItsNameDatePlaceAndCommittee(t *testing.T) {
	cm := newManager(t)

	created, err := call(t, tool(t, cm, "council_meeting_create"),
		`{"instance_id":"town-1","name":"Budget session","date":"2026-12-03","place":"Town hall","committee":"Finance"}`)
	if err != nil {
		t.Fatal(err)
	}
	var made meetingRow
	if err := json.Unmarshal(created, &made); err != nil || made.ID == "" {
		t.Fatalf("created = %s, %v", created, err)
	}

	read, err := call(t, tool(t, cm, "council_meeting_read"), `{"instance_id":"town-1","meetingID":"`+made.ID+`"}`)
	if err != nil {
		t.Fatal(err)
	}
	var got meetingRow
	if err := json.Unmarshal(read, &got); err != nil {
		t.Fatalf("%s: %v", read, err)
	}
	want := meetingRow{ID: made.ID, Name: "Budget session", Date: "2026-12-03", Place: "Town hall", Committee: "Finance"}
	if got != want {
		t.Fatalf("read = %+v, want %+v", got, want)
	}
}

func TestListIsEarliestDayFirstAndNarrowedToOneAgencyAndCommittee(t *testing.T) {
	cm := newManager(t)
	create := tool(t, cm, "council_meeting_create")
	for _, body := range []string{
		`{"instance_id":"town-1","name":"Later","date":"2026-12-10","committee":"Finance"}`,
		`{"instance_id":"town-1","name":"Earlier","date":"2026-12-01","committee":"Roads"}`,
		`{"instance_id":"town-2","name":"Elsewhere","date":"2026-12-02"}`,
	} {
		if _, err := call(t, create, body); err != nil {
			t.Fatal(err)
		}
	}

	all, err := call(t, tool(t, cm, "council_meeting_list"), `{"instance_id":"town-1"}`)
	if err != nil {
		t.Fatal(err)
	}
	finance, err := call(t, tool(t, cm, "council_meeting_list"), `{"instance_id":"town-1","committee":"Finance"}`)
	if err != nil {
		t.Fatal(err)
	}

	names := func(raw json.RawMessage) string {
		var rows []meetingRow
		if err := json.Unmarshal(raw, &rows); err != nil {
			t.Fatalf("%s: %v", raw, err)
		}
		var out []string
		for _, r := range rows {
			out = append(out, r.Name)
		}
		return strings.Join(out, ",")
	}
	if got := names(all); got != "Earlier,Later" {
		t.Errorf("all = %s, want Earlier,Later", got)
	}
	if got := names(finance); got != "Later" {
		t.Errorf("finance = %s, want Later", got)
	}
}

func TestAnotherAgencyCannotReadTheMeeting(t *testing.T) {
	cm := newManager(t)
	created, err := call(t, tool(t, cm, "council_meeting_create"), `{"instance_id":"town-1","name":"Private","date":"2026-12-01"}`)
	if err != nil {
		t.Fatal(err)
	}
	var made meetingRow
	if err := json.Unmarshal(created, &made); err != nil {
		t.Fatal(err)
	}

	_, err = call(t, tool(t, cm, "council_meeting_read"), `{"instance_id":"town-2","meetingID":"`+made.ID+`"}`)

	if err == nil {
		t.Fatal("agency town-2 read the meeting of town-1")
	}
}

func TestCreateRefusesAMeetingWithoutNameOrWithABadDate(t *testing.T) {
	cm := newManager(t)
	create := tool(t, cm, "council_meeting_create")
	for name, body := range map[string]string{
		"no name":   `{"instance_id":"town-1","name":"  ","date":"2026-12-01"}`,
		"no date":   `{"instance_id":"town-1","name":"Session"}`,
		"bad date":  `{"instance_id":"town-1","name":"Session","date":"3 December"}`,
		"no agency": `{"name":"Session","date":"2026-12-01"}`,
	} {
		if _, err := call(t, create, body); err == nil {
			t.Errorf("%s: the meeting was accepted", name)
		}
	}
}

func TestListNeedsTheAgency(t *testing.T) {
	cm := newManager(t)

	if _, err := call(t, tool(t, cm, "council_meeting_list"), `{}`); err == nil {
		t.Fatal("list without instance_id was accepted")
	}
}
