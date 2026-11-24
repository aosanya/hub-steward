package http

import (
	"context"
	"net/http"
	"reflect"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

const amendmentPrompt = "Changed: Report a referral: Reason"
const amendmentText = `Changed from "Needs a clinic check" to "Needs a clinic check at once"`

func amendmentPlan() []stepSpec {
	return append(promptedPlan(), stepSpec{title: "Close the referral", prompt: "Record how it ended.", form: "Closing", role: "Doctor", questions: []agencymodels.StepQuestion{
		{Prompt: "Outcome", AnswerType: agencymodels.AnswerFreeText, Required: true},
	}})
}

func savedRowsOf(t *testing.T, w stepRunWalk, step string) []agencymodels.RecordRow {
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
	item, err := m.GetWorkItem(ctx, w.steps[step])
	if err != nil {
		t.Fatalf("GetWorkItem: %v", err)
	}
	var rows []agencymodels.RecordRow
	for _, id := range drafts {
		found, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{})
		if err != nil {
			t.Fatalf("ListRecordRows: %v", err)
		}
		for _, row := range found {
			if row.RoleID == item.RoleID {
				rows = append(rows, row)
			}
		}
	}
	return rows
}

func accountOf(t *testing.T, w stepRunWalk, cookie *http.Cookie) string {
	t.Helper()
	s, err := w.deps.Sessions.Verify(context.Background(), cookie.Value)
	if err != nil {
		t.Fatalf("verify session: %v", err)
	}
	return s.MemberID
}

func TestAStepSentWithAnAmendmentAnswerStoresItWithTheSenderAndTheTime(t *testing.T) {
	w := newStepRunWalk(t, amendmentPlan(), "Volunteer", "Liaison", "Doctor")
	first := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Needs a clinic check", "Minutes to the clinic": "25"}, "")
	if first.Code != http.StatusCreated {
		t.Fatalf("the volunteer's submit: %d %s", first.Code, first.Body.String())
	}
	orderID, _ := decodeObject(t, first)["order_id"].(string)

	answers := map[string]string{"Arrived": "yes", amendmentPrompt: amendmentText}
	sent := w.submit(t, w.people["Liaison"], "Confirm arrival", answers, orderID)
	if sent.Code != http.StatusCreated {
		t.Fatalf("the liaison's submit with an amendment answer: %d %s", sent.Code, sent.Body.String())
	}

	rows := savedRowsOf(t, w, "Confirm arrival")
	if len(rows) != 1 {
		t.Fatalf("the liaison's saved rows = %v, want one", rows)
	}
	row := rows[0]
	if w.promptsOfRow(t, row)[amendmentPrompt] != amendmentText || w.promptsOfRow(t, row)["Arrived"] != "yes" {
		t.Errorf("the saved answers = %v", row.Answers)
	}
	if want := accountOf(t, w, w.people["Liaison"]); row.AddedBy != want || want == "" {
		t.Errorf("AddedBy = %q, want the liaison %q", row.AddedBy, want)
	}
	if row.CreatedAt == "" {
		t.Errorf("CreatedAt is empty")
	}
}

func TestAnAmendedStepLeavesTheFollowingRoleItsEarlierAnswersAndItsNextStep(t *testing.T) {
	w := newStepRunWalk(t, amendmentPlan(), "Volunteer", "Liaison", "Doctor")
	first := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Needs a clinic check", "Minutes to the clinic": "25"}, "")
	if first.Code != http.StatusCreated {
		t.Fatalf("the volunteer's submit: %d %s", first.Code, first.Body.String())
	}
	orderID, _ := decodeObject(t, first)["order_id"].(string)
	sent := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes", amendmentPrompt: amendmentText}, orderID)
	if sent.Code != http.StatusCreated {
		t.Fatalf("the liaison's submit: %d %s", sent.Code, sent.Body.String())
	}
	next, _ := decodeObject(t, sent)["next_step"].(map[string]any)
	if next["prompt"] != "Record how it ended." {
		t.Errorf("the next step = %v", next)
	}

	waiting := w.available(t, w.people["Doctor"])
	if len(waiting) != 1 {
		t.Fatalf("the doctor's waiting steps = %v", waiting)
	}
	earlier := earlierOf(t, waiting[0])
	if len(earlier) != 2 {
		t.Fatalf("the doctor's earlier = %v, want the volunteer's and the liaison's steps", earlier)
	}
	wantVolunteer := []any{
		map[string]any{"prompt": "Reason", "answer": "Needs a clinic check"},
		map[string]any{"prompt": "Minutes to the clinic", "answer": "25"},
	}
	if !reflect.DeepEqual(earlier[0]["answers"], wantVolunteer) {
		t.Errorf("the volunteer's earlier answers = %v, want %v", earlier[0]["answers"], wantVolunteer)
	}
	wantLiaison := map[string]any{"prompt": "Arrived", "answer": "yes"}
	liaison, _ := earlier[1]["answers"].([]any)
	if len(liaison) == 0 || !reflect.DeepEqual(liaison[0], wantLiaison) {
		t.Errorf("the liaison's earlier answers = %v", earlier[1]["answers"])
	}

	done := w.submit(t, w.people["Doctor"], "Close the referral", map[string]string{"Outcome": "Seen the same day"}, orderID)
	if done.Code != http.StatusCreated {
		t.Errorf("the doctor's send after an amendment: %d %s", done.Code, done.Body.String())
	}
}
