package http

import (
	"net/http"
	"reflect"
	"testing"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func memberQuestion(prompt string) agencymodels.StepQuestion {
	return agencymodels.StepQuestion{Prompt: prompt, AnswerType: agencymodels.AnswerSingleChoice, Required: true, OptionsFrom: "members"}
}

func withEnteredBy(_ stepRunWalk, r *agencymodels.Record) {
	r.Questions = append(r.Questions, memberQuestion("Entered by"))
}

func addStepOf(t *testing.T, items []map[string]any) map[string]any {
	t.Helper()
	for _, item := range items {
		if item["generated"] == true && item["row_action"] == "add" && item["title"] == "Add a tender" {
			return item
		}
	}
	t.Fatalf("no generated Add a tender step in %v", titles(items))
	return nil
}

func memberNames(t *testing.T, item map[string]any) map[string]string {
	t.Helper()
	listed, _ := item["members"].([]any)
	out := map[string]string{}
	for _, raw := range listed {
		member, _ := raw.(map[string]any)
		if keys := len(member); keys != 2 {
			t.Errorf("a member choice carries %v, want its id and name only", member)
		}
		id, _ := member["id"].(string)
		name, _ := member["name"].(string)
		out[id] = name
	}
	return out
}

func TestAStepThatPicksAMemberListsTheMembersToPickFrom(t *testing.T) {
	w := newRowStepWalk(t, withEnteredBy)
	names := memberNames(t, addStepOf(t, w.availableWithGenerated(t, w.people["Coordinator"])))

	for _, role := range []string{"Volunteer", "Liaison", "Coordinator"} {
		if got := names[w.subjects[role]]; got != role {
			t.Errorf("the member %s is offered as %q, want %q (offered: %v)", w.subjects[role], got, role, names)
		}
	}
}

func TestAStepWithNoMemberQuestionListsNoMembers(t *testing.T) {
	w := newRowStepWalk(t, nil)
	for _, item := range w.availableWithGenerated(t, w.people["Coordinator"]) {
		if _, carried := item["members"]; carried {
			t.Errorf("%v carries members though it asks for none", item["title"])
		}
	}
}

func TestTheChosenMemberIsKeptAsTheAnswer(t *testing.T) {
	w := newRowStepWalk(t, withEnteredBy)
	chosen := w.subjects["Liaison"]

	rec := w.send(t, w.people["Coordinator"], "add", map[string]any{"answers": map[string]string{"Tender": "Road survey", "Entered by": chosen}})

	if rec.Code != http.StatusCreated {
		t.Fatalf("add with a chosen member: %d %s, want 201", rec.Code, rec.Body.String())
	}
	rows := w.rows(t, "")
	if len(rows) != 1 || w.promptsOfRow(t, rows[0])["Entered by"] != chosen {
		t.Errorf("the rows = %+v, want Entered by %s", rows, chosen)
	}
}

func TestTheNextStepReadsAChosenMemberByName(t *testing.T) {
	w := newStepRunWalk(t, []stepSpec{
		{title: "Open the case", form: "Case", role: "Volunteer", questions: []agencymodels.StepQuestion{memberQuestion("Owner")}},
		{title: "Check the case", form: "Check", role: "Liaison", questions: []agencymodels.StepQuestion{{Prompt: "Note", AnswerType: agencymodels.AnswerFreeText, Required: true}}},
	}, "Volunteer", "Liaison")

	rec := w.submit(t, w.people["Volunteer"], "Open the case", map[string]string{"Owner": w.subjects["Liaison"]}, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("open the case: %d %s", rec.Code, rec.Body.String())
	}

	var earlier []any
	for _, item := range w.available(t, w.people["Liaison"]) {
		if item["title"] == "Check the case" {
			earlier, _ = item["earlier"].([]any)
		}
	}
	if len(earlier) != 1 {
		t.Fatalf("the next step shows %v earlier steps, want one", earlier)
	}
	got := earlier[0].(map[string]any)["answers"]
	want := []any{map[string]any{"prompt": "Owner", "answer": "Liaison"}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("the earlier answers = %v, want %v", got, want)
	}
}
