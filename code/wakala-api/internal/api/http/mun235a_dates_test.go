package http

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"
)

type mun235aWorld struct {
	walk  stepRunWalk
	group string
	polls string
	forms string
}

func newMUN235aWorld(t *testing.T) *mun235aWorld {
	t.Helper()
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance
	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Town hall"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)
	return &mun235aWorld{walk: w, group: groupID, polls: path + "/voting/polls", forms: path + "/forms"}
}

func (m *mun235aWorld) poll(t *testing.T, opens, closes any) (int, map[string]any) {
	t.Helper()
	rec := m.walk.call(t, "POST", m.polls, map[string]any{
		"question": "Close Mill Row on Sundays?", "choices": []map[string]any{{"label": "yes"}, {"label": "no"}},
		"group_ids": []string{m.group}, "opens_at": opens, "closes_at": closes,
	}, m.walk.owner)
	return rec.Code, mun235aObject(rec.Body.Bytes())
}

func (m *mun235aWorld) form(t *testing.T, fields map[string]any) (int, map[string]any) {
	t.Helper()
	body := map[string]any{"title": "Street survey"}
	for k, v := range fields {
		body[k] = v
	}
	rec := m.walk.call(t, "POST", m.forms+"/forms", body, m.walk.owner)
	return rec.Code, mun235aObject(rec.Body.Bytes())
}

func (m *mun235aWorld) patchForm(t *testing.T, id string, fields map[string]any) (int, map[string]any) {
	t.Helper()
	body := map[string]any{"title": "Street survey", "audience": "member", "collection_mode": "self", "closes_at": "2099-01-01T00:00:00Z"}
	for k, v := range fields {
		body[k] = v
	}
	rec := m.walk.call(t, "PATCH", m.forms+"/forms/"+id, body, m.walk.owner)
	return rec.Code, mun235aObject(rec.Body.Bytes())
}

func mun235aObject(raw []byte) map[string]any {
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return out
}

func mun235aNoServerError(t *testing.T, name string, code int, body map[string]any) {
	t.Helper()
	if code >= http.StatusInternalServerError {
		t.Fatalf("%s: %d %v, want no server error", name, code, body)
	}
}

func mun235aStranger() *http.Cookie {
	return &http.Cookie{Name: "stranger", Value: "none"}
}

func TestMUN235a_PollWindowsAreAcceptedOrRefusedNeverServerErrors(t *testing.T) {
	m := newMUN235aWorld(t)
	for _, c := range []struct {
		name          string
		opens, closes any
		want          int
	}{
		{"year 1", "0001-01-01T00:00:00Z", "0001-01-02T00:00:00Z", http.StatusCreated},
		{"year 0", "0000-01-01T00:00:00Z", "2026-11-08T00:00:00Z", http.StatusCreated},
		{"year 9999", "2026-11-08T00:00:00Z", "9999-12-31T23:59:59Z", http.StatusCreated},
		{"year 10000", "2026-11-08T00:00:00Z", "10000-01-01T00:00:00Z", http.StatusBadRequest},
		{"words", "tomorrow", "next week", http.StatusBadRequest},
		{"empty", "", "", http.StatusBadRequest},
		{"null", nil, nil, http.StatusBadRequest},
		{"numbers", 1762560000, 1765152000, http.StatusBadRequest},
		{"leap day", "2028-02-29T00:00:00Z", "2028-03-01T00:00:00Z", http.StatusCreated},
		{"nanoseconds", "2026-11-08T00:00:00.123456789Z", "2026-12-08T00:00:00.987654321Z", http.StatusCreated},
		{"zero offset", "2026-11-08T00:00:00+00:00", "2026-12-08T00:00:00+00:00", http.StatusCreated},
		{"same instant spelled two ways", "2026-11-08T00:00:00Z", "2026-11-08T00:00:00.000Z", http.StatusBadRequest},
	} {
		code, body := m.poll(t, c.opens, c.closes)
		mun235aNoServerError(t, c.name, code, body)
		if code != c.want {
			t.Errorf("%s: %d %v, want %d", c.name, code, body, c.want)
		}
	}
}

func TestMUN235a_PollWindowThatIsNotARealTimestampIsRefused(t *testing.T) {
	t.Skip("MUN682: opens_at and closes_at are compared and stored as text; remove this line with the fix")
	m := newMUN235aWorld(t)
	for _, c := range []struct{ name, opens, closes string }{
		{"no zone", "2026-11-08T00:00:00", "2026-12-08T00:00:00"},
		{"date only", "2026-11-08", "2026-12-08"},
		{"February 30", "2026-02-30T00:00:00Z", "2026-03-31T00:00:00Z"},
		{"hour 24", "2026-11-08T24:00:00Z", "2026-11-09T00:00:00Z"},
		{"leap second", "2016-12-31T23:59:59Z", "2016-12-31T23:59:60Z"},
		{"lowercase separators", "2026-11-08t00:00:00z", "2026-12-08t00:00:00z"},
		{"padded", " 2026-11-08T00:00:00Z", "2026-12-08T00:00:00Z "},
	} {
		code, body := m.poll(t, c.opens, c.closes)
		if code != http.StatusBadRequest {
			t.Errorf("%s: %d %v, want 400", c.name, code, body)
		}
	}
}

func TestMUN235a_PollWindowIsComparedByInstantNotByText(t *testing.T) {
	t.Skip("MUN682: opens_at and closes_at are compared and stored as text; remove this line with the fix")
	m := newMUN235aWorld(t)
	if code, body := m.poll(t, "2026-11-08T00:00:00Z", "2026-11-08T12:00:00+14:00"); code != http.StatusBadRequest {
		t.Errorf("closes 22:00 UTC the day before it opens: %d %v, want 400", code, body)
	}
	if code, body := m.poll(t, "2026-11-08T05:00:00+14:00", "2026-11-08T00:00:00Z"); code != http.StatusCreated {
		t.Errorf("a ten hour window with an opening offset: %d %v, want 201", code, body)
	}
}

func TestMUN235a_PollWindowsAtTheEdgesOfTheCalendarAreAnswerableByAResident(t *testing.T) {
	pa := newPollAnswerWalk(t)
	for _, c := range []struct{ name, opens, closes string }{
		{"year 9999 close", "2020-01-01T00:00:00Z", "9999-12-31T23:59:59Z"},
		{"year 1 open", "0001-01-01T00:00:00Z", "2099-01-01T00:00:00Z"},
		{"offsets", "2020-01-01T00:00:00+14:00", "2099-01-01T00:00:00-12:00"},
		{"leap day open", "2020-02-29T00:00:00Z", "2099-01-01T00:00:00Z"},
	} {
		made := pa.call(t, "POST", pa.polls, map[string]any{
			"question": c.name, "mode": "one", "per_group": "once", "group_ids": []string{pa.groupID},
			"opens_at": c.opens, "closes_at": c.closes, "choices": []map[string]any{{"label": "green"}, {"label": "blue"}},
		}, pa.owner)
		if made.Code != http.StatusCreated {
			t.Fatalf("%s: create %d %s", c.name, made.Code, made.Body.String())
		}
		id, _ := decodeObject(t, made)["id"].(string)
		choices := pa.call(t, "GET", pa.polls+"/"+id+"/choices", nil, pa.inside)
		if choices.Code != http.StatusOK {
			t.Fatalf("%s: resident lists choices %d %s", c.name, choices.Code, choices.Body.String())
		}
		choiceID, _ := decodeObjects(t, choices)[0]["id"].(string)
		answer := pa.call(t, "POST", pa.polls+"/"+id+"/answers", map[string]any{"votes": map[string]int{choiceID: 1}}, pa.inside)
		if answer.Code != http.StatusCreated {
			t.Errorf("%s: resident answers %d %s, want 201", c.name, answer.Code, answer.Body.String())
		}
		if count := pa.call(t, "GET", pa.polls+"/"+id+"/count", nil, pa.owner); count.Code != http.StatusOK {
			t.Errorf("%s: count %d %s, want 200", c.name, count.Code, count.Body.String())
		}
	}
}

func TestMUN235a_PollWithAWindowOfNoRealTimestampsIsNotLeftInvisibleToResidents(t *testing.T) {
	t.Skip("MUN682: a date-only, no-zone, lowercase or padded window is created 201 and then 404 for every resident; remove this line with the fix")
	pa := newPollAnswerWalk(t)
	for _, c := range []struct{ name, opens, closes string }{
		{"date only", "2020-01-01", "2099-01-01"},
		{"no zone", "2020-01-01T00:00:00", "2099-01-01T00:00:00"},
		{"lowercase", "2020-01-01t00:00:00z", "2099-01-01t00:00:00z"},
		{"padded", " 2020-01-01T00:00:00Z", "2099-01-01T00:00:00Z"},
	} {
		made := pa.call(t, "POST", pa.polls, map[string]any{
			"question": c.name, "mode": "one", "per_group": "once", "group_ids": []string{pa.groupID},
			"opens_at": c.opens, "closes_at": c.closes, "choices": []map[string]any{{"label": "green"}, {"label": "blue"}},
		}, pa.owner)
		if made.Code != http.StatusCreated {
			continue
		}
		id, _ := decodeObject(t, made)["id"].(string)
		if read := pa.call(t, "GET", pa.polls+"/"+id+"/choices", nil, pa.inside); read.Code != http.StatusOK {
			t.Errorf("%s: owner created it 201, resident reads %d %s", c.name, read.Code, read.Body.String())
		}
	}
}

func TestMUN235a_FormWindowsAreAcceptedOrRefusedNeverServerErrors(t *testing.T) {
	m := newMUN235aWorld(t)
	for _, c := range []struct {
		name   string
		fields map[string]any
		want   int
	}{
		{"year 9999", map[string]any{"closes_at": "9999-12-31T23:59:59Z"}, http.StatusCreated},
		{"year 10000", map[string]any{"closes_at": "10000-01-01T00:00:00Z"}, http.StatusBadRequest},
		{"in the past", map[string]any{"closes_at": "2020-01-01T00:00:00Z"}, http.StatusBadRequest},
		{"year 1", map[string]any{"closes_at": "0001-01-01T00:00:00Z"}, http.StatusBadRequest},
		{"no zone", map[string]any{"closes_at": "2099-01-01T00:00:00"}, http.StatusBadRequest},
		{"date only", map[string]any{"closes_at": "2099-01-01"}, http.StatusBadRequest},
		{"words", map[string]any{"closes_at": "soon"}, http.StatusBadRequest},
		{"number", map[string]any{"closes_at": 4070908800}, http.StatusBadRequest},
		{"null", map[string]any{"closes_at": nil}, http.StatusBadRequest},
		{"leap day", map[string]any{"closes_at": "2096-02-29T12:00:00Z"}, http.StatusCreated},
		{"not a leap day", map[string]any{"closes_at": "2099-02-29T12:00:00Z"}, http.StatusBadRequest},
		{"padded", map[string]any{"closes_at": " 2099-01-01T00:00:00Z"}, http.StatusBadRequest},
		{"lowercase separators", map[string]any{"closes_at": "2099-01-01t00:00:00z"}, http.StatusBadRequest},
		{"opens in year 1", map[string]any{"opens_at": "0001-01-01T00:00:00Z", "closes_at": "2099-01-01T00:00:00Z"}, http.StatusCreated},
		{"opens in year 9999", map[string]any{"opens_at": "9999-01-01T00:00:00Z", "closes_at": "2099-01-01T00:00:00Z"}, http.StatusBadRequest},
		{"opens no zone", map[string]any{"opens_at": "2098-01-01T00:00:00", "closes_at": "2099-01-01T00:00:00Z"}, http.StatusBadRequest},
		{"opens words", map[string]any{"opens_at": "yesterday", "closes_at": "2099-01-01T00:00:00Z"}, http.StatusBadRequest},
		{"closes first by instant", map[string]any{"opens_at": "2098-01-01T00:00:00Z", "closes_at": "2098-01-01T12:00:00+14:00"}, http.StatusBadRequest},
		{"window by instant with an opening offset", map[string]any{"opens_at": "2098-01-01T05:00:00+14:00", "closes_at": "2098-01-01T00:00:00Z"}, http.StatusCreated},
		{"closes at the instant it opens", map[string]any{"opens_at": "2098-01-01T00:00:00Z", "closes_at": "2098-01-01T00:00:00.000Z"}, http.StatusBadRequest},
	} {
		code, body := m.form(t, c.fields)
		mun235aNoServerError(t, c.name, code, body)
		if code != c.want {
			t.Errorf("%s: %d %v, want %d", c.name, code, body, c.want)
		}
	}
}

func TestMUN235a_FormSchedulesAreAcceptedOrRefusedNeverServerErrors(t *testing.T) {
	m := newMUN235aWorld(t)
	budapest := func(extra map[string]any) map[string]any {
		out := map[string]any{"start": "2098-01-01T00:00:00Z", "zone": "Europe/Budapest", "rule": "FREQ=WEEKLY;BYDAY=MO"}
		for k, v := range extra {
			out[k] = v
		}
		return out
	}
	for _, c := range []struct {
		name     string
		schedule map[string]any
		want     int
	}{
		{"no zone", budapest(map[string]any{"zone": ""}), http.StatusBadRequest},
		{"unknown zone", budapest(map[string]any{"zone": "Mars/Olympus"}), http.StatusBadRequest},
		{"weekly in Budapest", budapest(nil), http.StatusCreated},
		{"month day 31", budapest(map[string]any{"start": "2098-01-31T00:00:00Z", "rule": "FREQ=MONTHLY;BYMONTHDAY=31"}), http.StatusCreated},
		{"yearly on February 29", budapest(map[string]any{"start": "2096-02-29T00:00:00Z", "rule": "FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29"}), http.StatusCreated},
		{"start inside the spring DST gap", budapest(map[string]any{"start": "2098-03-29T02:30:00+01:00", "rule": "FREQ=DAILY"}), http.StatusCreated},
		{"start in the year 1", budapest(map[string]any{"start": "0001-01-01T00:00:00Z", "rule": "FREQ=DAILY"}), http.StatusBadRequest},
		{"start in the year 9999", budapest(map[string]any{"start": "9999-12-31T00:00:00Z", "rule": "FREQ=DAILY"}), http.StatusCreated},
		{"start with an offset", budapest(map[string]any{"start": "2098-01-01T00:00:00+14:00", "zone": "Pacific/Kiritimati"}), http.StatusCreated},
		{"dates with a day that does not exist", map[string]any{"start": "2098-01-01T00:00:00Z", "zone": "Europe/Budapest", "end": "2099-01-01T00:00:00Z", "dates": []string{"2099-02-29", "2099-13-01"}}, http.StatusBadRequest},
		{"dates with a leap day", map[string]any{"start": "2020-01-01T00:00:00Z", "zone": "Europe/Budapest", "end": "2099-01-01T00:00:00Z", "dates": []string{"2096-02-29", "2020-01-01"}}, http.StatusCreated},
		{"end before start", budapest(map[string]any{"start": "2098-06-01T00:00:00Z", "end": "2098-01-01T00:00:00Z"}), http.StatusBadRequest},
		{"negative open days", budapest(map[string]any{"open_days": -5}), http.StatusBadRequest},
		{"two billion open days", budapest(map[string]any{"rule": "FREQ=DAILY", "open_days": 2000000000}), http.StatusCreated},
		{"largest integer open days", budapest(map[string]any{"rule": "FREQ=DAILY", "open_days": 9223372036854775807}), http.StatusCreated},
		{"start words", budapest(map[string]any{"start": "x"}), http.StatusBadRequest},
	} {
		code, body := m.form(t, map[string]any{"closes_at": "2099-01-01T00:00:00Z", "audience": "public", "schedule": c.schedule})
		mun235aNoServerError(t, c.name, code, body)
		if code != c.want {
			t.Errorf("%s: %d %v, want %d", c.name, code, body, c.want)
		}
	}
}

func TestMUN235a_PublicDoorOfARepeatingFormNeverServerErrorsOnOddSchedules(t *testing.T) {
	m := newMUN235aWorld(t)
	w := m.walk
	for i, schedule := range []map[string]any{
		{"start": "2098-01-01T00:00:00Z", "zone": "Europe/Budapest", "rule": "FREQ=DAILY", "open_days": 2000000000},
		{"start": "2098-01-01T00:00:00Z", "zone": "Europe/Budapest", "rule": "FREQ=DAILY", "open_days": 9223372036854775807},
		{"start": "9999-12-31T00:00:00Z", "zone": "Europe/Budapest", "rule": "FREQ=DAILY"},
		{"start": "2096-02-29T00:00:00Z", "zone": "Europe/Budapest", "rule": "FREQ=YEARLY"},
		{"start": "2098-01-31T00:00:00Z", "zone": "Europe/Budapest", "rule": "FREQ=MONTHLY"},
		{"start": "2098-03-29T02:30:00+01:00", "zone": "Europe/Budapest", "rule": "FREQ=DAILY"},
		{"start": "2098-01-01T00:00:00+14:00", "zone": "Pacific/Kiritimati", "rule": "FREQ=WEEKLY"},
		{"start": "2020-01-01T00:00:00Z", "zone": "Europe/Budapest", "end": "2099-01-01T00:00:00Z", "dates": []string{"2096-02-29", "2020-01-01"}},
	} {
		code, created := m.form(t, map[string]any{"closes_at": "2099-01-01T00:00:00Z", "audience": "public", "schedule": schedule})
		if code != http.StatusCreated {
			t.Fatalf("schedule %d: create %d %v", i, code, created)
		}
		id, _ := created["id"].(string)
		key := "mun235a-door-" + string(rune('a'+i))
		if rec := w.call(t, "POST", m.forms+"/forms/"+id+"/publish", map[string]any{"candidate_link_key": key}, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("schedule %d: publish %d %s", i, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "GET", m.forms+"/public-links/"+key, nil, mun235aStranger()); rec.Code != http.StatusOK {
			t.Errorf("schedule %d: door %d %s, want 200", i, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "POST", m.forms+"/public-links/"+key+"/respondents", map[string]any{}, mun235aStranger()); rec.Code != http.StatusOK {
			t.Errorf("schedule %d: register %d %s, want 200", i, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "GET", m.forms+"/forms", nil, w.owner); rec.Code != http.StatusOK {
			t.Errorf("schedule %d: list %d %s, want 200", i, rec.Code, rec.Body.String())
		}
		for _, periodKey := range []string{"2098-01-05", "2026-11-11", "9999-12-31", "0001-01-01", "2026-13-45", "abc", "2026-02-29", "2028-02-29"} {
			rec := w.call(t, "GET", m.forms+"/forms/"+id+"/periods/"+periodKey+"/missed", nil, w.owner)
			if rec.Code >= http.StatusInternalServerError {
				t.Errorf("schedule %d: missed %s %d %s, want no server error", i, periodKey, rec.Code, rec.Body.String())
			}
		}
	}
}

func TestMUN235a_FormWindowEditsKeepTheCreateRulesAndAPastCloseCannotBePublished(t *testing.T) {
	m := newMUN235aWorld(t)
	w := m.walk
	code, created := m.form(t, map[string]any{"closes_at": "2099-01-01T00:00:00Z", "audience": "public"})
	if code != http.StatusCreated {
		t.Fatalf("create %d %v", code, created)
	}
	id, _ := created["id"].(string)
	for _, c := range []struct {
		name   string
		fields map[string]any
		want   int
	}{
		{"year 9999", map[string]any{"closes_at": "9999-12-31T23:59:59Z"}, http.StatusOK},
		{"year 10000", map[string]any{"closes_at": "10000-01-01T00:00:00Z"}, http.StatusBadRequest},
		{"no zone", map[string]any{"closes_at": "2099-01-01T00:00:00"}, http.StatusBadRequest},
		{"words", map[string]any{"closes_at": "never"}, http.StatusBadRequest},
		{"empty close", map[string]any{"closes_at": ""}, http.StatusBadRequest},
		{"opens after it closes", map[string]any{"opens_at": "2100-01-01T00:00:00Z"}, http.StatusBadRequest},
		{"opens date only", map[string]any{"opens_at": "2098-01-01"}, http.StatusBadRequest},
		{"opens cleared", map[string]any{"opens_at": ""}, http.StatusOK},
		{"leap day close", map[string]any{"closes_at": "2096-02-29T00:00:00Z"}, http.StatusOK},
		{"schedule start words", map[string]any{"schedule": map[string]any{"start": "x", "zone": "Europe/Budapest"}}, http.StatusBadRequest},
		{"weekly schedule", map[string]any{"schedule": map[string]any{"start": "2098-01-01T00:00:00Z", "zone": "Europe/Budapest", "rule": "FREQ=WEEKLY;BYDAY=MO"}}, http.StatusOK},
	} {
		code, body := m.patchForm(t, id, c.fields)
		mun235aNoServerError(t, c.name, code, body)
		if code != c.want {
			t.Errorf("%s: %d %v, want %d", c.name, code, body, c.want)
		}
	}
	if code, body := m.patchForm(t, id, map[string]any{"audience": "public", "closes_at": "2020-01-01T00:00:00Z"}); code != http.StatusOK {
		t.Fatalf("edit to a close in the past: %d %v", code, body)
	}
	if rec := w.call(t, "POST", m.forms+"/forms/"+id+"/publish", map[string]any{"candidate_link_key": "mun235a-past"}, w.owner); rec.Code != http.StatusBadRequest {
		t.Errorf("publish a draft that closes in the past: %d %s, want 400", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", m.forms+"/public-links/mun235a-past", nil, mun235aStranger()); rec.Code != http.StatusNotFound {
		t.Errorf("door of a draft that closes in the past: %d %s, want 404", rec.Code, rec.Body.String())
	}
}

type mun235aAnswers struct {
	*mun235aWorld
	formID     string
	dateID     string
	boundedID  string
	timeID     string
	sendCookie *http.Cookie
}

func newMUN235aAnswers(t *testing.T) mun235aAnswers {
	t.Helper()
	m := newMUN235aWorld(t)
	w := m.walk
	code, created := m.form(t, map[string]any{"closes_at": "2099-01-01T00:00:00Z", "audience": "member", "collection_mode": "self", "originator_chapter_id": m.group})
	if code != http.StatusCreated {
		t.Fatalf("create form: %d %v", code, created)
	}
	formID, _ := created["id"].(string)
	ask := func(question map[string]any) string {
		rec := w.call(t, "POST", m.forms+"/forms/"+formID+"/questions", question, w.owner)
		if rec.Code != http.StatusCreated {
			t.Fatalf("add question %v: %d %s", question, rec.Code, rec.Body.String())
		}
		made, _ := mun235aObject(rec.Body.Bytes())["question"].(map[string]any)
		id, _ := made["id"].(string)
		return id
	}
	out := mun235aAnswers{mun235aWorld: m, formID: formID, sendCookie: w.owner}
	out.dateID = ask(map[string]any{"prompt": "When", "answer_type": "date"})
	out.boundedID = ask(map[string]any{"prompt": "Within", "answer_type": "date", "min_date": "2026-01-01", "max_date": "2026-12-31"})
	out.timeID = ask(map[string]any{"prompt": "At", "answer_type": "time"})
	if rec := w.call(t, "POST", m.forms+"/forms/"+formID+"/targets", map[string]any{"chapter_id": m.group}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("add target: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", m.forms+"/forms/"+formID+"/publish", map[string]any{}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body.String())
	}
	return out
}

func (a mun235aAnswers) send(t *testing.T, query string, answer map[string]any) int {
	t.Helper()
	rec := a.walk.call(t, "POST", a.forms+"/forms/"+a.formID+"/answers"+query, map[string]any{"answers": []map[string]any{answer}}, a.sendCookie)
	if rec.Code >= http.StatusInternalServerError {
		t.Fatalf("answer %v%s: %d %s, want no server error", answer, query, rec.Code, rec.Body.String())
	}
	return rec.Code
}

func TestMUN235a_FormDateAnswersAreStrictCalendarDates(t *testing.T) {
	a := newMUN235aAnswers(t)
	for _, c := range []struct {
		value string
		want  int
	}{
		{"2028-02-29", http.StatusOK},
		{"0000-01-01", http.StatusOK},
		{"0001-01-01", http.StatusOK},
		{"9999-12-31", http.StatusOK},
		{"2026-02-29", http.StatusBadRequest},
		{"2026-1-5", http.StatusBadRequest},
		{"2026-13-01", http.StatusBadRequest},
		{"2026-11-08T10:00:00Z", http.StatusBadRequest},
		{" 2026-11-08", http.StatusBadRequest},
		{"２０２６-11-08", http.StatusBadRequest},
		{"", http.StatusBadRequest},
	} {
		if got := a.send(t, "", map[string]any{"question_id": a.dateID, "value_date": c.value}); got != c.want {
			t.Errorf("date answer %q: %d, want %d", c.value, got, c.want)
		}
	}
	for _, c := range []struct {
		value string
		want  int
	}{
		{"2026-01-01", http.StatusOK},
		{"2026-12-31", http.StatusOK},
		{"2026-06-15", http.StatusOK},
		{"2025-12-31", http.StatusBadRequest},
		{"2027-01-01", http.StatusBadRequest},
	} {
		if got := a.send(t, "", map[string]any{"question_id": a.boundedID, "value_date": c.value}); got != c.want {
			t.Errorf("bounded date answer %q: %d, want %d", c.value, got, c.want)
		}
	}
}

func TestMUN235a_FormQuestionDateBoundsAreStrictCalendarDates(t *testing.T) {
	m := newMUN235aWorld(t)
	w := m.walk
	_, created := m.form(t, map[string]any{"closes_at": "2099-01-01T00:00:00Z"})
	id, _ := created["id"].(string)
	for _, c := range []struct {
		name     string
		question map[string]any
		want     int
	}{
		{"minimum after maximum", map[string]any{"prompt": "x", "answer_type": "date", "min_date": "2027-01-01", "max_date": "2026-01-01"}, http.StatusBadRequest},
		{"minimum February 30", map[string]any{"prompt": "x", "answer_type": "date", "min_date": "2026-02-30"}, http.StatusBadRequest},
		{"minimum with a time", map[string]any{"prompt": "x", "answer_type": "date", "min_date": "2026-01-01T00:00:00Z"}, http.StatusBadRequest},
		{"year 1 to year 9999", map[string]any{"prompt": "x", "answer_type": "date", "min_date": "0001-01-01", "max_date": "9999-12-31"}, http.StatusCreated},
		{"date bound on a time question", map[string]any{"prompt": "x", "answer_type": "time", "min_date": "2026-01-01"}, http.StatusBadRequest},
	} {
		rec := w.call(t, "POST", m.forms+"/forms/"+id+"/questions", c.question, w.owner)
		if rec.Code >= http.StatusInternalServerError {
			t.Fatalf("%s: %d %s, want no server error", c.name, rec.Code, rec.Body.String())
		}
		if rec.Code != c.want {
			t.Errorf("%s: %d %s, want %d", c.name, rec.Code, rec.Body.String(), c.want)
		}
	}
}

func TestMUN235a_FormTimeAnswersAreClockTimesInHoursAndMinutes(t *testing.T) {
	a := newMUN235aAnswers(t)
	for _, c := range []struct {
		value string
		want  int
	}{
		{"23:59", http.StatusOK},
		{"00:00", http.StatusOK},
		{"24:00", http.StatusBadRequest},
		{"25:00", http.StatusBadRequest},
		{"23:60", http.StatusBadRequest},
		{"12:00:00", http.StatusBadRequest},
		{"12:00+02:00", http.StatusBadRequest},
		{"noon", http.StatusBadRequest},
		{" 12:00", http.StatusBadRequest},
		{"", http.StatusBadRequest},
	} {
		if got := a.send(t, "", map[string]any{"question_id": a.timeID, "value_time": c.value}); got != c.want {
			t.Errorf("time answer %q: %d, want %d", c.value, got, c.want)
		}
	}
}

func TestMUN235a_FormTimeAnswerWithAOneDigitHourIsNotStoredAsTyped(t *testing.T) {
	t.Skip("MUN700: value_time 7:05 is accepted and stored as typed, while a date 2026-1-5 is refused; remove this line with the fix")
	a := newMUN235aAnswers(t)
	got := a.send(t, "", map[string]any{"question_id": a.timeID, "value_time": "7:05"})
	if got == http.StatusOK {
		rec := a.walk.call(t, "GET", a.forms+"/forms/"+a.formID+"/answers", nil, a.walk.owner)
		for _, stored := range decodeObjects(t, rec) {
			if stored["value_time"] == "7:05" {
				t.Errorf("stored value_time %q, want 400 or 07:05", stored["value_time"])
			}
		}
	}
}

func TestMUN235a_PeriodKeyOnAFormThatDoesNotRepeatIsIgnoredAndNeverStored(t *testing.T) {
	a := newMUN235aAnswers(t)
	for _, key := range []string{"2026-02-30", "abc", "9999-12-31", "0001-01-01", ""} {
		if got := a.send(t, "?period_key="+key, map[string]any{"question_id": a.dateID, "value_date": "2026-11-08"}); got != http.StatusOK {
			t.Errorf("period_key %q: %d, want 200", key, got)
		}
	}
	rec := a.walk.call(t, "GET", a.forms+"/forms/"+a.formID+"/answers", nil, a.walk.owner)
	for _, stored := range decodeObjects(t, rec) {
		if key, _ := stored["period_key"].(string); key != "" {
			t.Errorf("stored period_key %q on a form that does not repeat", key)
		}
	}
}

func TestMUN235a_StampsTheCallerSendsOnAPollAreReplacedByTheServer(t *testing.T) {
	m := newMUN235aWorld(t)
	rec := m.walk.call(t, "POST", m.polls, map[string]any{
		"question": "Close Mill Row on Sundays?", "choices": []map[string]any{{"label": "yes"}, {"label": "no"}},
		"group_ids": []string{m.group}, "opens_at": "2026-11-08T00:00:00Z", "closes_at": "2026-12-08T00:00:00Z",
		"created_at": "1900-01-01T00:00:00Z", "published_at": "1900-01-02T00:00:00Z", "state": "published",
	}, m.walk.owner)
	if rec.Code >= http.StatusInternalServerError {
		t.Fatalf("poll with stamps: %d %s", rec.Code, rec.Body.String())
	}
	if rec.Code != http.StatusCreated {
		return
	}
	poll := mun235aObject(rec.Body.Bytes())
	created, _ := poll["created_at"].(string)
	if parsed, err := time.Parse(time.RFC3339Nano, created); err != nil || parsed.Year() < 2026 {
		t.Errorf("created_at %q, want the server's own time", created)
	}
	if poll["state"] != "draft" {
		t.Errorf("state %v, want draft", poll["state"])
	}
	if published, _ := poll["published_at"].(string); published != "" {
		t.Errorf("published_at %q, want empty on a draft", published)
	}
}

func TestMUN235a_StampsTheCallerSendsOnAFormAreReplacedByTheServer(t *testing.T) {
	m := newMUN235aWorld(t)
	code, body := m.form(t, map[string]any{
		"closes_at": "2099-01-01T00:00:00Z", "created_at": "1900-01-01T00:00:00Z", "last_updated": "1900-01-01T00:00:00Z",
		"published_at": "1900-01-02T00:00:00Z", "closed_at": "1900-01-03T00:00:00Z", "approved_at": "1900-01-04T00:00:00Z",
		"status": "open", "results_published_at": "1900-01-05T00:00:00Z",
	})
	mun235aNoServerError(t, "form with stamps", code, body)
	if code != http.StatusCreated {
		return
	}
	if body["status"] != "draft" {
		t.Errorf("status %v, want draft", body["status"])
	}
	for _, field := range []string{"published_at", "closed_at", "approved_at", "results_published_at"} {
		if got, _ := body[field].(string); got != "" {
			t.Errorf("%s %q, want empty on a new draft", field, got)
		}
	}
	for _, field := range []string{"created_at", "last_updated"} {
		got, _ := body[field].(string)
		if parsed, err := time.Parse(time.RFC3339Nano, got); err != nil || strings.HasPrefix(got, "1900") || parsed.Year() < 2026 {
			t.Errorf("%s %q, want the server's own time", field, got)
		}
	}
}
