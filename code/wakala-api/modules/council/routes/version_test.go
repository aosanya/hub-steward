package routes

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const oldVersion = "2020-01-01T00:00:00Z"

type versioned struct {
	UpdatedAt string `json:"updated_at"`
}

func updatedAtOf(t *testing.T, raw json.RawMessage) string {
	t.Helper()
	var v versioned
	if err := json.Unmarshal(raw, &v); err != nil || v.UpdatedAt == "" {
		t.Fatalf("no updated_at in %s: %v", raw, err)
	}
	return v.UpdatedAt
}

func TestEveryAgendaAndMinutesToolDeclaresAnOptionalVersionArgument(t *testing.T) {
	cm := newManager(t)
	for _, name := range []string{"council_agenda_set", "council_minutes_set"} {
		var schema struct {
			Properties           map[string]json.RawMessage `json:"properties"`
			Required             []string                   `json:"required"`
			AdditionalProperties bool                       `json:"additionalProperties"`
		}
		if err := json.Unmarshal(tool(t, cm, name).InputSchema, &schema); err != nil {
			t.Fatal(err)
		}
		if _, ok := schema.Properties["version"]; !ok {
			t.Errorf("%s declares no version argument: %v", name, schema.Properties)
		}
		for _, required := range schema.Required {
			if required == "version" {
				t.Errorf("%s requires version", name)
			}
		}
		if schema.AdditionalProperties {
			t.Errorf("%s accepts unknown arguments", name)
		}
	}
}

func TestAnAgendaSetOnTheVersionJustReadIsAccepted(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	set := tool(t, cm, "council_agenda_set")
	if _, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","items":["Old"]}`); err != nil {
		t.Fatal(err)
	}
	read, err := call(t, tool(t, cm, "council_agenda_read"), `{"instance_id":"town-1","meetingID":"`+meeting+`"}`)
	if err != nil {
		t.Fatal(err)
	}

	out, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","items":["New"],"version":"`+updatedAtOf(t, read)+`"}`)
	if err != nil {
		t.Fatalf("a save on the current version was refused: %v", err)
	}
	var got agendaRow
	if err := json.Unmarshal(out, &got); err != nil || strings.Join(got.Items, "|") != "New" {
		t.Fatalf("agenda = %s, %v", out, err)
	}
}

func TestAnAgendaSetOnAnOldVersionNamesTheItemsAndChangesNothing(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	set := tool(t, cm, "council_agenda_set")
	if _, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","items":["Kept"]}`); err != nil {
		t.Fatal(err)
	}

	_, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","items":["Lost"],"version":"`+oldVersion+`"}`)
	if err == nil || err.Error() != "items changed since you read it" {
		t.Fatalf("error = %v, want %q", err, "items changed since you read it")
	}
	read, err := call(t, tool(t, cm, "council_agenda_read"), `{"instance_id":"town-1","meetingID":"`+meeting+`"}`)
	if err != nil {
		t.Fatal(err)
	}
	var got agendaRow
	if err := json.Unmarshal(read, &got); err != nil || strings.Join(got.Items, "|") != "Kept" {
		t.Fatalf("agenda = %s, %v", read, err)
	}
}

func TestAnAgendaSetWithNoVersionIsAcceptedAsBefore(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	set := tool(t, cm, "council_agenda_set")
	for _, items := range []string{`["One"]`, `["Two"]`} {
		if _, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","items":`+items+`}`); err != nil {
			t.Fatal(err)
		}
	}
}

func TestAnAgendaSetOnAnOldVersionBeforeAnyAgendaExistsIsAccepted(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	if _, err := call(t, tool(t, cm, "council_agenda_set"),
		`{"instance_id":"town-1","meetingID":"`+meeting+`","items":["First"],"version":"`+oldVersion+`"}`); err != nil {
		t.Fatalf("a first save was refused: %v", err)
	}
}

func TestMinutesSetOnTheVersionJustReadAreAccepted(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	set := tool(t, cm, "council_minutes_set")
	if _, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","text":"Draft."}`); err != nil {
		t.Fatal(err)
	}
	read, err := call(t, tool(t, cm, "council_minutes_read"), `{"instance_id":"town-1","meetingID":"`+meeting+`"}`)
	if err != nil {
		t.Fatal(err)
	}

	out, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","text":"Adopted.","version":"`+updatedAtOf(t, read)+`"}`)
	if err != nil {
		t.Fatalf("a save on the current version was refused: %v", err)
	}
	var got minutesRow
	if err := json.Unmarshal(out, &got); err != nil || got.Text != "Adopted." {
		t.Fatalf("minutes = %s, %v", out, err)
	}
}

func TestMinutesSetOnAnOldVersionNameTheTextAndChangeNothing(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	set := tool(t, cm, "council_minutes_set")
	if _, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","text":"Kept."}`); err != nil {
		t.Fatal(err)
	}

	_, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","text":"Lost.","version":"`+oldVersion+`"}`)
	if err == nil || err.Error() != "text changed since you read it" {
		t.Fatalf("error = %v, want %q", err, "text changed since you read it")
	}
	read, err := call(t, tool(t, cm, "council_minutes_read"), `{"instance_id":"town-1","meetingID":"`+meeting+`"}`)
	if err != nil {
		t.Fatal(err)
	}
	var got minutesRow
	if err := json.Unmarshal(read, &got); err != nil || got.Text != "Kept." {
		t.Fatalf("minutes = %s, %v", read, err)
	}
}

func TestMinutesSetWithNoVersionAreAcceptedAsBefore(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	set := tool(t, cm, "council_minutes_set")
	for _, text := range []string{"One.", "Two."} {
		if _, err := call(t, set, `{"instance_id":"town-1","meetingID":"`+meeting+`","text":"`+text+`"}`); err != nil {
			t.Fatal(err)
		}
	}
}

func TestAStaleSaveOverHTTPIsAConflictThatSaysWhatChanged(t *testing.T) {
	cm := newManager(t)
	meeting := newMeeting(t, cm, "town-1")
	if _, err := call(t, tool(t, cm, "council_minutes_set"),
		`{"instance_id":"town-1","meetingID":"`+meeting+`","text":"Kept."}`); err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	for _, r := range Routes(cm) {
		mux.HandleFunc(r.Pattern(""), r.Handler)
	}

	req := httptest.NewRequest(http.MethodPut, "/council/meetings/"+meeting+"/minutes",
		strings.NewReader(`{"instance_id":"town-1","text":"Lost.","version":"`+oldVersion+`"}`))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Body.String(), "text changed since you read it") {
		t.Fatalf("body = %s", rec.Body)
	}
}
