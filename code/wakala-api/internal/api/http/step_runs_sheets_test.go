package http

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func sheetsWalk(t *testing.T) stepRunWalk {
	t.Helper()
	return newStepRunWalk(t, []stepSpec{
		{title: "Open case", form: "Case form", role: "Clerk", questions: []agencymodels.StepQuestion{
			{Prompt: "Applicant", AnswerType: agencymodels.AnswerFreeText, Required: true},
		}},
		{title: "Sheet", form: "Sheet form", role: "Clerk", questions: []agencymodels.StepQuestion{
			{Prompt: "Sheet note", AnswerType: agencymodels.AnswerFreeText, Required: true},
		}},
		{title: "Review", form: "Review form", role: "Reviewer", questions: []agencymodels.StepQuestion{
			{Prompt: "Verdict", AnswerType: agencymodels.AnswerFreeText},
		}},
	}, "Clerk", "Reviewer")
}

type sheetReply struct {
	code   int
	body   string
	fields map[string]any
}

func (w stepRunWalk) sendSheet(t *testing.T, step, orderID, sendKey, note string, anotherSheet bool) sheetReply {
	t.Helper()
	body := map[string]any{"answers": map[string]string{"Sheet note": note}, "order_id": orderID}
	if anotherSheet {
		body["another_sheet"] = true
	}
	if sendKey != "" {
		body["send_key"] = sendKey
	}
	rec := w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps[step]+"/answers", body, w.people["Clerk"])
	reply := sheetReply{code: rec.Code, body: rec.Body.String()}
	_ = json.Unmarshal(rec.Body.Bytes(), &reply.fields)
	return reply
}

func (w stepRunWalk) sheetRecordCode(t *testing.T, m mwanachamaagency.AgencyManager) string {
	t.Helper()
	ctx := context.Background()
	steps, err := m.ListWorkItems(ctx, w.draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		t.Fatalf("ListWorkItems: %v", err)
	}
	records, err := m.ListRecords(ctx, w.draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	for _, link := range formStepsByWorkflow(steps, records)[w.workflow] {
		if link.step.ID == w.steps["Sheet"] {
			return link.record.Code
		}
	}
	t.Fatal("the Sheet step keeps no register")
	return ""
}

func (w stepRunWalk) sheetRows(t *testing.T, orderID string) []agencymodels.RecordRow {
	t.Helper()
	ctx := context.Background()
	m, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		t.Fatalf("drafts: %v", err)
	}
	code := w.sheetRecordCode(t, m)
	var out []agencymodels.RecordRow
	for _, id := range drafts {
		rows, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{RecordCode: code})
		if err != nil {
			t.Fatalf("ListRecordRows: %v", err)
		}
		for _, row := range rows {
			if row.OrderID == orderID && !row.Deleted {
				out = append(out, row)
			}
		}
	}
	return out
}

func startedSheetRun(t *testing.T, w stepRunWalk) string {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps["Open case"]+"/answers",
		map[string]any{"answers": map[string]string{"Applicant": "Aino"}}, w.people["Clerk"])
	if rec.Code != http.StatusCreated {
		t.Fatalf("open case: %d %s", rec.Code, rec.Body.String())
	}
	orderID, _ := decodeObject(t, rec)["order_id"].(string)
	first := w.sendSheet(t, "Sheet", orderID, "", "sheet 1", false)
	if first.code != http.StatusCreated {
		t.Fatalf("first sheet: %d %s", first.code, first.body)
	}
	return orderID
}

func TestThreeSheetsOnOneRunGiveThreeRowsInTheStepsRegister(t *testing.T) {
	w := sheetsWalk(t)
	orderID := startedSheetRun(t, w)
	for i, note := range []string{"sheet 2", "sheet 3"} {
		got := w.sendSheet(t, "Sheet", orderID, "", note, true)
		if got.code != http.StatusCreated {
			t.Fatalf("another sheet %d: %d %s", i+2, got.code, got.body)
		}
		if got.fields["order_id"] != orderID || got.fields["done"] != true {
			t.Errorf("sheet %d reply = %s", i+2, got.body)
		}
	}
	if rows := w.sheetRows(t, orderID); len(rows) != 3 {
		t.Fatalf("rows of the step on the run = %d, want 3", len(rows))
	}
}

func TestResendingASheetKeyIsRefusedAsAlreadySent(t *testing.T) {
	w := sheetsWalk(t)
	orderID := startedSheetRun(t, w)
	if got := w.sendSheet(t, "Sheet", orderID, "k-2", "sheet 2", true); got.code != http.StatusCreated {
		t.Fatalf("sheet 2: %d %s", got.code, got.body)
	}
	if got := w.sendSheet(t, "Sheet", orderID, "k-2", "sheet 2 again", true); got.code != http.StatusConflict {
		t.Fatalf("resend = %d %s, want 409", got.code, got.body)
	}
	if rows := w.sheetRows(t, orderID); len(rows) != 2 {
		t.Fatalf("rows = %d, want 2", len(rows))
	}
}

func TestAnotherSheetOnAStepNotYetSentIsRefused(t *testing.T) {
	w := sheetsWalk(t)
	rec := w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps["Open case"]+"/answers",
		map[string]any{"answers": map[string]string{"Applicant": "Aino"}}, w.people["Clerk"])
	orderID, _ := decodeObject(t, rec)["order_id"].(string)
	if got := w.sendSheet(t, "Sheet", orderID, "", "sheet 1", true); got.code != http.StatusConflict {
		t.Fatalf("another sheet before the first = %d %s, want 409", got.code, got.body)
	}
	if rows := w.sheetRows(t, orderID); len(rows) != 0 {
		t.Fatalf("rows = %d, want 0", len(rows))
	}
}

func TestAnotherSheetOnTheFirstStepIsRefusedWithoutARun(t *testing.T) {
	w := sheetsWalk(t)
	rec := w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps["Open case"]+"/answers",
		map[string]any{"answers": map[string]string{"Applicant": "Aino"}, "another_sheet": true}, w.people["Clerk"])
	if rec.Code == http.StatusCreated {
		t.Fatalf("another sheet with no run was accepted: %s", rec.Body.String())
	}
}

func TestWithoutAnotherSheetASecondSendOfASentStepStaysRefused(t *testing.T) {
	w := sheetsWalk(t)
	orderID := startedSheetRun(t, w)
	if got := w.sendSheet(t, "Sheet", orderID, "", "sheet 2", false); got.code != http.StatusConflict {
		t.Fatalf("plain second send = %d %s, want 409", got.code, got.body)
	}
}
