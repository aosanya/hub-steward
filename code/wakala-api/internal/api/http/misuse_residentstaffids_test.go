package http

import (
	"net/http"
	"strings"
	"testing"
)

var staffAccountFields = []string{"created_by", "published_by", "closed_by", "submitted_by", "approved_by"}

func refuteStaffIds(t *testing.T, where, body, staffID string, object map[string]any) {
	t.Helper()
	if strings.Contains(body, staffID) {
		t.Fatalf("%s holds the staff member id %s: %s", where, staffID, body)
	}
	for _, field := range staffAccountFields {
		if _, held := object[field]; held {
			t.Fatalf("%s holds %s: %s", where, field, body)
		}
	}
}

func TestFormsRead_ResidentReadsNoStaffMemberIdOnWaitingAnsweredAndTheForm(t *testing.T) {
	p := newDeclaredGroupProbe(t)
	formPath := p.forms + "/forms/" + p.targeted

	staff := p.walk.call(t, "GET", formPath, nil, p.walk.owner)
	if staff.Code != http.StatusOK {
		t.Fatalf("owner reads the form: %d %s", staff.Code, staff.Body.String())
	}
	staffForm := decodeObject(t, staff)
	staffID, _ := staffForm["created_by"].(string)
	if staffID == "" || staffForm["published_by"] != staffID {
		t.Fatalf("staff read no longer holds created_by and published_by: %s", staff.Body.String())
	}

	resident := p.memberOfWard(t)

	waiting := p.walk.call(t, "GET", p.forms+"/forms/waiting", nil, resident)
	if waiting.Code != http.StatusOK {
		t.Fatalf("resident reads waiting: %d %s", waiting.Code, waiting.Body.String())
	}
	waitingRows := decodeObjects(t, waiting)
	if len(waitingRows) == 0 {
		t.Fatalf("resident's waiting list is empty: %s", waiting.Body.String())
	}
	for _, row := range waitingRows {
		refuteStaffIds(t, "resident's waiting list", waiting.Body.String(), staffID, row)
	}
	row := waitingRows[0]
	if row["form_id"] != p.targeted || row["title"] != "Kertváros ward round" || row["originator_chapter_id"] == nil || row["closes_at"] == "" || row["questions"] != float64(1) {
		t.Fatalf("resident no longer gets what the Waiting list shows: %s", waiting.Body.String())
	}

	read := p.walk.call(t, "GET", formPath, nil, resident)
	if read.Code != http.StatusOK {
		t.Fatalf("resident reads the form: %d %s", read.Code, read.Body.String())
	}
	form := decodeObject(t, read)
	refuteStaffIds(t, "resident's form", read.Body.String(), staffID, form)
	if form["id"] != p.targeted || form["title"] != "Kertváros ward round" || form["status"] != "open" || form["closes_at"] == "" || form["audience"] != "member" || form["originator_chapter_id"] == nil {
		t.Fatalf("resident no longer gets what the form page shows: %s", read.Body.String())
	}

	questions := p.walk.call(t, "GET", formPath+"/questions", nil, resident)
	if questions.Code != http.StatusOK {
		t.Fatalf("resident lists the questions: %d %s", questions.Code, questions.Body.String())
	}
	questionID, _ := decodeObjects(t, questions)[0]["id"].(string)
	answered := p.walk.call(t, "POST", formPath+"/answers", map[string]any{"answers": []map[string]any{{"question_id": questionID, "value_text": "two"}}}, resident)
	if answered.Code != http.StatusOK {
		t.Fatalf("resident answers: %d %s", answered.Code, answered.Body.String())
	}

	sent := p.walk.call(t, "GET", p.forms+"/forms/answered", nil, resident)
	if sent.Code != http.StatusOK {
		t.Fatalf("resident reads answered: %d %s", sent.Code, sent.Body.String())
	}
	sentRows := decodeObjects(t, sent)
	if len(sentRows) == 0 {
		t.Fatalf("resident's answered list is empty: %s", sent.Body.String())
	}
	for _, row := range sentRows {
		refuteStaffIds(t, "resident's answered list", sent.Body.String(), staffID, row)
	}
	row = sentRows[0]
	if row["form_id"] != p.targeted || row["title"] != "Kertváros ward round" || row["status"] != "open" || row["answered_at"] == "" || row["send_id"] == "" {
		t.Fatalf("resident no longer gets what the Answered list shows: %s", sent.Body.String())
	}

	again := p.walk.call(t, "GET", formPath, nil, p.walk.owner)
	if got := decodeObject(t, again); got["created_by"] != staffID || got["published_by"] != staffID {
		t.Fatalf("staff read lost the whole record: %s", again.Body.String())
	}
}

func TestPollRead_ResidentReadsNoStaffMemberIdOnThePollOrItsPublishedResult(t *testing.T) {
	w := newPollAnswerWalk(t)
	poll := w.polls + "/" + w.pollID

	staff := w.call(t, "GET", poll, nil, w.owner)
	if staff.Code != http.StatusOK {
		t.Fatalf("owner reads the poll: %d %s", staff.Code, staff.Body.String())
	}
	staffID, _ := decodeObject(t, staff)["created_by"].(string)
	if staffID == "" {
		t.Fatalf("staff read no longer holds created_by: %s", staff.Body.String())
	}

	if rec := w.call(t, "POST", poll+"/result", map[string]any{"group_ids": []string{w.groupID}}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner publishes the result: %d %s", rec.Code, rec.Body.String())
	}
	published := decodeObject(t, w.call(t, "GET", poll, nil, w.owner))
	if published["published_by"] != staffID {
		t.Fatalf("staff read no longer holds published_by: %v", published)
	}
	if code := w.answer(t, w.inside); code != http.StatusCreated {
		t.Fatalf("resident answers the poll: %d", code)
	}

	read := w.call(t, "GET", poll, nil, w.inside)
	if read.Code != http.StatusOK {
		t.Fatalf("resident reads the poll: %d %s", read.Code, read.Body.String())
	}
	object := decodeObject(t, read)
	refuteStaffIds(t, "resident's poll", read.Body.String(), staffID, object)
	if object["id"] != w.pollID || object["question"] != "Bench colour" || object["mode"] != "one" || object["closes_at"] == "" || object["published_at"] == "" || object["state"] == "" {
		t.Fatalf("resident no longer gets what the poll page shows: %s", read.Body.String())
	}

	result := w.call(t, "GET", poll+"/result", nil, w.inside)
	if result.Code != http.StatusOK {
		t.Fatalf("resident reads the published result: %d %s", result.Code, result.Body.String())
	}
	refuteStaffIds(t, "resident's published result", result.Body.String(), staffID, decodeObject(t, result))
	if decodeObject(t, result)["poll_id"] != w.pollID {
		t.Fatalf("resident no longer gets the result: %s", result.Body.String())
	}
}
