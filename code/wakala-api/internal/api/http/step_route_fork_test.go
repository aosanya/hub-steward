package http

import (
	"net/http"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

const (
	sheetsClerk     = "District clerk"
	sheetsLiaison   = "Liaison"
	sheetsChecker   = "Checker"
	howItArrived    = "How did the answer arrive?"
	arrivedOnPaper  = "Paper"
	arrivedByPhone  = "Phone"
	arrivedOnScreen = "Screen"
)

func sheetsRoundPlan() []stepSpec {
	done := []agencymodels.StepQuestion{{Prompt: "Done", AnswerType: agencymodels.AnswerYesNo, Required: true}}
	arrival := []agencymodels.StepQuestion{{
		Prompt: howItArrived, AnswerType: agencymodels.AnswerSingleChoice, Required: true,
		Options: []string{arrivedOnPaper, arrivedByPhone, arrivedOnScreen},
	}}
	return []stepSpec{
		{title: "Collect the sheets", form: "Collect", role: sheetsLiaison, questions: done},
		{title: "Hand over the sheets", form: "Handover", role: sheetsClerk, kind: agencymodels.StepKindSendForm, questions: arrival},
		{title: "Sort by arrival", kind: agencymodels.StepKindRoute, fork: &forkSpec{
			sentTitle: "Hand over the sheets", question: howItArrived,
			caseOrder:     []string{arrivedOnPaper, arrivedByPhone},
			cases:         map[string]string{arrivedOnPaper: "Key in paper", arrivedByPhone: "Key in phone"},
			otherwiseStep: "Check consent",
		}},
		{title: "Key in paper", form: "Paper", role: sheetsClerk, questions: done},
		{title: "Key in phone", form: "Phone", role: sheetsClerk, questions: done},
		{title: "Check consent", form: "Consent", role: sheetsChecker, questions: done},
	}
}

func sheetsRound(t *testing.T) stepRunWalk {
	t.Helper()
	return newStepRunWalk(t, sheetsRoundPlan(), sheetsClerk, sheetsLiaison, sheetsChecker)
}

func startedSheetsRound(t *testing.T, w stepRunWalk, arrived string) string {
	t.Helper()
	first := w.submit(t, w.people[sheetsLiaison], "Collect the sheets", map[string]string{"Done": "yes"}, "")
	if first.Code != http.StatusCreated {
		t.Fatalf("collect: %d %s", first.Code, first.Body.String())
	}
	order, _ := decodeObject(t, first)["order_id"].(string)
	handed := w.submit(t, w.people[sheetsClerk], "Hand over the sheets", map[string]string{howItArrived: arrived}, order)
	if handed.Code != http.StatusCreated {
		t.Fatalf("hand over: %d %s", handed.Code, handed.Body.String())
	}
	return order
}

func nextTitleOf(t *testing.T, rec map[string]any) string {
	t.Helper()
	next, _ := rec["next_step"].(map[string]any)
	title, _ := next["title"].(string)
	return title
}

func TestASentFormStepIsAnsweredByItsRecipientAndTheRouteSendsTheRunDownOneBranch(t *testing.T) {
	cases := map[string]string{
		arrivedOnPaper:  "Key in paper",
		arrivedByPhone:  "Key in phone",
		arrivedOnScreen: "Check consent",
	}
	for arrived, want := range cases {
		t.Run(arrived, func(t *testing.T) {
			w := sheetsRound(t)
			first := w.submit(t, w.people[sheetsLiaison], "Collect the sheets", map[string]string{"Done": "yes"}, "")
			if first.Code != http.StatusCreated {
				t.Fatalf("collect: %d %s", first.Code, first.Body.String())
			}
			firstBody := decodeObject(t, first)
			if got := nextTitleOf(t, firstBody); got != "Hand over the sheets" {
				t.Fatalf("after collecting the run waits at %q, want the sent form", got)
			}
			order, _ := firstBody["order_id"].(string)
			handed := w.submit(t, w.people[sheetsClerk], "Hand over the sheets", map[string]string{howItArrived: arrived}, order)
			if handed.Code != http.StatusCreated {
				t.Fatalf("the recipient answers the sent form: %d %s", handed.Code, handed.Body.String())
			}
			if got := nextTitleOf(t, decodeObject(t, handed)); got != want {
				t.Errorf("a sheet that arrived by %q goes next to %q, want %q", arrived, got, want)
			}
		})
	}
}

func TestTheOtherBranchIsRefusedAndTheRunRejoinsAfterTheChosenOne(t *testing.T) {
	w := sheetsRound(t)
	order := startedSheetsRound(t, w, arrivedOnPaper)
	wrong := w.submit(t, w.people[sheetsClerk], "Key in phone", map[string]string{"Done": "yes"}, order)
	if wrong.Code != http.StatusConflict {
		t.Fatalf("the phone branch of a paper run answers %d, want 409: %s", wrong.Code, wrong.Body.String())
	}
	keyed := w.submit(t, w.people[sheetsClerk], "Key in paper", map[string]string{"Done": "yes"}, order)
	if keyed.Code != http.StatusCreated {
		t.Fatalf("key in paper: %d %s", keyed.Code, keyed.Body.String())
	}
	if got := nextTitleOf(t, decodeObject(t, keyed)); got != "Check consent" {
		t.Errorf("after the paper branch the run goes to %q, want the check", got)
	}
	if got := titles(w.available(t, w.people[sheetsClerk])); len(got) != 0 {
		t.Errorf("the clerk still sees %v after the branch is done", got)
	}
	if got := titles(w.available(t, w.people[sheetsChecker])); !sameTitles(got, []string{"Check consent"}) {
		t.Errorf("the checker sees %v, want the check", got)
	}
}

func TestTheClerkSeesTheSentFormWhenTheRunReachesIt(t *testing.T) {
	w := sheetsRound(t)
	if got := titles(w.available(t, w.people[sheetsClerk])); len(got) != 0 {
		t.Fatalf("before the run starts the clerk sees %v", got)
	}
	first := w.submit(t, w.people[sheetsLiaison], "Collect the sheets", map[string]string{"Done": "yes"}, "")
	if first.Code != http.StatusCreated {
		t.Fatalf("collect: %d %s", first.Code, first.Body.String())
	}
	if got := titles(w.available(t, w.people[sheetsClerk])); !sameTitles(got, []string{"Hand over the sheets"}) {
		t.Errorf("the clerk sees %v, want the sent form only", got)
	}
}
