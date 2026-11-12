package http

import (
	"context"
	"net/http"
	"net/url"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

func (w stepRunWalk) sentSteps(t *testing.T, as *http.Cookie, query string) []map[string]any {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-sent-steps"+query, nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("my-sent-steps%s: %d %s", query, rec.Code, rec.Body.String())
	}
	return decodeObjects(t, rec)
}

func (w stepRunWalk) sendReferral(t *testing.T, reason string) string {
	t.Helper()
	sent := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": reason, "Minutes to the clinic": "25"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the volunteer's submit: %d %s", sent.Code, sent.Body.String())
	}
	order, _ := decodeObject(t, sent)["order_id"].(string)
	return order
}

func TestAMemberWhoSentAStepSeesItWithItsOrderFormAndAnswers(t *testing.T) {
	w := referral(t)
	if got := w.sentSteps(t, w.people["Volunteer"], ""); len(got) != 0 {
		t.Fatalf("before any send the volunteer sees %v, want none", got)
	}
	order := w.sendReferral(t, "Needs a clinic check")

	got := w.sentSteps(t, w.people["Volunteer"], "")
	if len(got) != 1 {
		t.Fatalf("the volunteer sees %d sent steps, want 1: %v", len(got), got)
	}
	item := got[0]
	answers, _ := item["answers"].(map[string]any)
	if item["step_id"] != w.steps["Report a referral"] || item["title"] != "Report a referral" || item["form_name"] != "Referral" ||
		item["workflow_id"] != w.workflow || item["workflow_name"] != "Case referral" || item["order_id"] != order ||
		item["record_code"] == "" || item["row_id"] == "" || item["sent_at"] == "" ||
		answers["Reason"] != "Needs a clinic check" || answers["Minutes to the clinic"] != "25" {
		t.Errorf("the sent step = %v", item)
	}
}

func TestAnotherMembersRowsNeverAppearInMySentSteps(t *testing.T) {
	w := referral(t)
	order := w.sendReferral(t, "Needs a clinic check")
	if arrived := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, order); arrived.Code != http.StatusCreated {
		t.Fatalf("the liaison's submit: %d %s", arrived.Code, arrived.Body.String())
	}

	if got := titles(w.sentSteps(t, w.people["Volunteer"], "")); !sameTitles(got, []string{"Report a referral"}) {
		t.Errorf("the volunteer sees %v, want only the step she sent", got)
	}
	if got := titles(w.sentSteps(t, w.people["Liaison"], "")); !sameTitles(got, []string{"Confirm arrival"}) {
		t.Errorf("the liaison sees %v, want only the step she sent", got)
	}
	if got := w.sentSteps(t, w.people["Coordinator"], ""); len(got) != 0 {
		t.Errorf("the coordinator sent nothing and sees %v", got)
	}
	if got := w.sentSteps(t, w.owner, ""); len(got) != 0 {
		t.Errorf("the owner sent nothing and sees %v", got)
	}
}

func TestMySentStepsComeNewestFirstInPages(t *testing.T) {
	w := referral(t)
	oldest := w.sendReferral(t, "First case")
	middle := w.sendReferral(t, "Second case")
	newest := w.sendReferral(t, "Third case")

	all := w.sentSteps(t, w.people["Volunteer"], "")
	if len(all) != 3 || all[0]["order_id"] != newest || all[1]["order_id"] != middle || all[2]["order_id"] != oldest {
		t.Fatalf("the volunteer sees %v, want the third, second and first case in that order", all)
	}

	page := w.sentSteps(t, w.people["Volunteer"], "?limit=2")
	if len(page) != 2 || page[1]["order_id"] != middle {
		t.Fatalf("the first page = %v, want the two newest", page)
	}
	rest := w.sentSteps(t, w.people["Volunteer"], "?limit=2&after="+url.QueryEscape(page[1]["row_id"].(string)))
	if len(rest) != 1 || rest[0]["order_id"] != oldest {
		t.Errorf("the page after the second = %v, want the oldest", rest)
	}

	if rec := w.call(t, "GET", "/instances/"+w.instance+"/my-sent-steps?limit=-1", nil, w.people["Volunteer"]); rec.Code != http.StatusBadRequest {
		t.Errorf("a negative limit answers %d, want 400", rec.Code)
	}
}

func TestAReplacedRowIsNotAMySentStep(t *testing.T) {
	w := referral(t)
	order := w.sendReferral(t, "Needs a clinic check")
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	first := w.sentSteps(t, w.people["Volunteer"], "")[0]
	records, err := mgr.ListRecords(ctx, w.draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	var register agencymodels.Record
	for _, r := range records {
		if r.Code == first["record_code"] {
			register = r
		}
	}
	rows, err := mgr.ListRecordRows(ctx, w.draftID, mwanachamaagency.RecordRowFilter{RecordCode: register.Code})
	if err != nil || len(rows) != 1 {
		t.Fatalf("ListRecordRows = %v, %v", rows, err)
	}
	corrected, err := mgr.CreateRecordRow(ctx, agencymodels.RecordRow{
		DraftID: w.draftID, RecordID: register.ID, RoleID: register.RoleID, AddedBy: rows[0].AddedBy, OrderID: order,
		Replaces: rows[0].ID, Answers: map[string]string{"Reason": "Corrected reason", "Minutes to the clinic": "30"},
	})
	if err != nil {
		t.Fatalf("CreateRecordRow: %v", err)
	}

	got := w.sentSteps(t, w.people["Volunteer"], "")
	answers, _ := got[0]["answers"].(map[string]any)
	if len(got) != 1 || got[0]["row_id"] != corrected.ID || answers["Reason"] != "Corrected reason" {
		t.Errorf("the volunteer sees %v, want only the corrected row", got)
	}
}
