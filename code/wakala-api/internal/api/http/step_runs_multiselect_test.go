package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

func multiSelectWalk(t *testing.T) stepRunWalk {
	t.Helper()
	return newStepRunWalk(t, []stepSpec{
		{title: "Report", form: "Report form", role: "Volunteer", questions: []agencymodels.StepQuestion{
			{Prompt: "Symptoms", AnswerType: agencymodels.AnswerMultiSelect, Required: true, Options: []string{"Fever", "Cough", "Rash, itchy"}},
			{Prompt: "Reason", AnswerType: agencymodels.AnswerFreeText},
		}},
	}, "Volunteer")
}

func (w stepRunWalk) send(t *testing.T, body map[string]any) (int, string) {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps["Report"]+"/answers", body, w.people["Volunteer"])
	return rec.Code, rec.Body.String()
}

func (w stepRunWalk) savedAnswer(t *testing.T, prompt string) string {
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
	var rows []agencymodels.RecordRow
	for _, id := range drafts {
		found, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{})
		if err != nil {
			t.Fatalf("ListRecordRows: %v", err)
		}
		rows = append(rows, found...)
	}
	if len(rows) == 0 {
		t.Fatal("no row was saved")
	}
	return rows[len(rows)-1].Answers[prompt]
}

func TestAMultiSelectAnswerIsAcceptedAsAListOrAsOneJoinedString(t *testing.T) {
	cases := []struct {
		name   string
		answer any
		want   string
	}{
		{"a list of labels", []string{"Fever", "Cough"}, "Fever, Cough"},
		{"a joined string", "Fever, Cough", "Fever, Cough"},
		{"one label", "Fever", "Fever"},
		{"a label that holds the separator, as a list", []string{"Rash, itchy"}, "Rash, itchy"},
		{"a label that holds the separator, as a string", "Rash, itchy", "Rash, itchy"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := multiSelectWalk(t)
			code, body := w.send(t, map[string]any{"answers": map[string]any{"Symptoms": c.answer}})
			if code != http.StatusCreated {
				t.Fatalf("submit: %d %s", code, body)
			}
			if got := w.savedAnswer(t, "Symptoms"); got != c.want {
				t.Errorf("saved %q, want %q", got, c.want)
			}
		})
	}
}

func TestAMultiSelectAnswerNamingAnOptionThatIsNotOfferedIsRefused(t *testing.T) {
	for name, answer := range map[string]any{"a list": []string{"Fever", "Headache"}, "a string": "Fever, Headache"} {
		t.Run(name, func(t *testing.T) {
			w := multiSelectWalk(t)
			if code, body := w.send(t, map[string]any{"answers": map[string]any{"Symptoms": answer}}); code != http.StatusBadRequest {
				t.Fatalf("submit: %d %s, want 400", code, body)
			}
		})
	}
}

func TestAListIsRefusedForAQuestionThatIsNotMultiSelect(t *testing.T) {
	w := multiSelectWalk(t)
	code, body := w.send(t, map[string]any{"answers": map[string]any{"Symptoms": "Fever", "Reason": []string{"a", "b"}}})
	if code != http.StatusBadRequest {
		t.Fatalf("submit: %d %s, want 400", code, body)
	}
}
