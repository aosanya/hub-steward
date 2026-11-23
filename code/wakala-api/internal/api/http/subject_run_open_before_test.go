package http

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func tenderPlan() []stepSpec {
	return []stepSpec{
		{title: "Record the tender", form: "Tender", role: "Volunteer", questions: []agencymodels.StepQuestion{
			{Prompt: "Tender title", AnswerType: agencymodels.AnswerFreeText, Required: true},
		}},
		{title: "Check the tender", form: "Check", role: "Liaison", questions: []agencymodels.StepQuestion{
			{Prompt: "Checked", AnswerType: agencymodels.AnswerYesNo, Required: true},
		}},
		{title: "Close the tender", form: "Closure", role: "Coordinator", questions: []agencymodels.StepQuestion{
			{Prompt: "Note", AnswerType: agencymodels.AnswerFreeText},
		}},
	}
}

func (w subjectWalk) openRunBeforeSubjects(t *testing.T, title string) string {
	t.Helper()
	ctx := context.Background()
	records, err := w.manager.ListRecords(ctx, w.liveID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	order := uuid.NewString()
	for _, r := range records {
		if r.Name != "Record the tender" {
			continue
		}
		if _, err := w.manager.CreateRecordRow(ctx, agencymodels.RecordRow{
			DraftID: w.liveID, RecordID: r.ID, RoleID: r.RoleID, AddedBy: "seed",
			Answers: map[string]string{"Tender title": title}, OrderID: order,
		}); err != nil {
			t.Fatalf("seed the run's first row: %v", err)
		}
		return order
	}
	t.Fatalf("the live version has no register named Record the tender")
	return ""
}

func TestARunOpenBeforeSubjectsKeepsWorkingWithoutARow(t *testing.T) {
	w := newSubjectWalkOn(t, true, tenderPlan())
	order := w.openRunBeforeSubjects(t, "Road survey")

	liaison := w.available(t, w.people["Liaison"])
	if len(liaison) != 1 || liaison[0]["order_id"] != order || liaison[0]["row_id"] != nil {
		t.Fatalf("the liaison's open steps = %v, want the old run's second step, with no row_id", liaison)
	}
	earlier, _ := liaison[0]["earlier"].([]any)
	if len(earlier) != 1 {
		t.Fatalf("the earlier work of the old run = %v, want the first step", liaison[0]["earlier"])
	}
	answers, _ := earlier[0].(map[string]any)["answers"].([]any)
	if len(answers) != 1 || answers[0].(map[string]any)["prompt"] != "Tender title" || answers[0].(map[string]any)["answer"] != "Road survey" {
		t.Errorf("the old run's Tender title answer = %v, want Road survey", answers)
	}

	checked := w.submit(t, w.people["Liaison"], "Check the tender", map[string]string{"Checked": "yes"}, order)
	if checked.Code != http.StatusCreated {
		t.Fatalf("the liaison sends the old run's step without a row: %d %s, want 201", checked.Code, checked.Body.String())
	}
	if next, _ := decodeObject(t, checked)["next_step"].(map[string]any); next["row_id"] != nil {
		t.Errorf("the next step of the old run = %v, want no row_id", next)
	}

	closed := w.submit(t, w.people["Coordinator"], "Close the tender", map[string]string{"Note": "Done"}, order)
	if closed.Code != http.StatusCreated {
		t.Fatalf("the coordinator closes the old run: %d %s, want 201", closed.Code, closed.Body.String())
	}
	if out := decodeObject(t, closed); out["next_step"] != nil {
		t.Errorf("the old run after its last step = %v, want no next step", out)
	}
	if left := w.available(t, w.people["Coordinator"]); len(left) != 0 {
		t.Errorf("the coordinator's open steps after the run finished = %v, want none", left)
	}
}
