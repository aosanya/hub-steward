package http

import (
	"net/http"
	"strings"
	"testing"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	mwanachamaaudit "github.com/aosanya/mwanachama-backend-audit"
)

const (
	sendBackDecisionPrompt = "Decision"
	sendBackReasonPrompt   = "Reason"
)

func proposalQuestions() []agencymodels.StepQuestion {
	return []agencymodels.StepQuestion{{Prompt: "Summary", AnswerType: agencymodels.AnswerFreeText, Required: true}}
}

func reviewQuestions() []agencymodels.StepQuestion {
	return []agencymodels.StepQuestion{
		{Prompt: sendBackDecisionPrompt, AnswerType: agencymodels.AnswerYesNo, Required: true},
		{Prompt: sendBackReasonPrompt, AnswerType: agencymodels.AnswerFreeText},
	}
}

func proposalPlan() []stepSpec {
	return []stepSpec{
		{title: "Write the proposal", form: "Proposal", role: "Lead", questions: proposalQuestions()},
		{title: "Approval for submission", form: "Approval for submission", role: "Director", questions: reviewQuestions(), sendBackDecision: sendBackDecisionPrompt, sendBackReason: sendBackReasonPrompt},
	}
}

func chainedProposalPlan() []stepSpec {
	return []stepSpec{
		{title: "Write the proposal", form: "Proposal", role: "Lead", questions: proposalQuestions()},
		{title: "Check the budget", form: "Budget check", role: "Finance", questions: []agencymodels.StepQuestion{{Prompt: "Budget fits", AnswerType: agencymodels.AnswerYesNo, Required: true}}},
		{title: "Approval for submission", form: "Approval for submission", role: "Director", questions: reviewQuestions(), sendBackDecision: sendBackDecisionPrompt, sendBackReason: sendBackReasonPrompt},
	}
}

func (w stepRunWalk) sendBack(t *testing.T, as *http.Cookie, step string, body map[string]any) (int, map[string]any) {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps[step]+"/send-back", body, as)
	if rec.Code != http.StatusOK {
		return rec.Code, nil
	}
	return rec.Code, decodeObject(t, rec)
}

func (w stepRunWalk) waitingFor(t *testing.T, as *http.Cookie, step string) map[string]any {
	t.Helper()
	for _, item := range w.available(t, as) {
		if item["id"] == w.steps[step] && item["state"] == "waiting" {
			return item
		}
	}
	return nil
}

func (w stepRunWalk) startedRun(t *testing.T, plan []stepSpec, answersByStep map[string]map[string]string) string {
	t.Helper()
	orderID := ""
	for _, s := range plan {
		answers, ok := answersByStep[s.title]
		if !ok {
			break
		}
		rec := w.submit(t, w.people[s.role], s.title, answers, orderID)
		if rec.Code != http.StatusCreated {
			t.Fatalf("send %s: %d %s", s.title, rec.Code, rec.Body.String())
		}
		orderID, _ = decodeObject(t, rec)["order_id"].(string)
	}
	return orderID
}

func TestTheDirectorSendsAStepBackAndTheLeadFindsItOpenWithTheReasonAndHerAnswers(t *testing.T) {
	w := newStepRunWalk(t, proposalPlan(), "Lead", "Director")
	order := w.startedRun(t, proposalPlan(), map[string]map[string]string{"Write the proposal": {"Summary": "Clean water for six villages"}})

	waiting := w.waitingFor(t, w.people["Director"], "Approval for submission")
	if waiting == nil {
		t.Fatalf("the director has no waiting approval step: %+v", w.available(t, w.people["Director"]))
	}
	prompts, _ := waiting["send_back"].(map[string]any)
	if prompts["decision"] != sendBackDecisionPrompt || prompts["reason"] != sendBackReasonPrompt {
		t.Errorf("the waiting step's send_back = %v, want the decision and reason prompts", waiting["send_back"])
	}
	if waiting["sent_back"] != nil {
		t.Errorf("a step that was never sent back carries sent_back %v", waiting["sent_back"])
	}

	code, reply := w.sendBack(t, w.people["Director"], "Approval for submission", map[string]any{"order_id": order, "reason": "The budget is missing", "send_key": "k-1"})
	if code != http.StatusOK {
		t.Fatalf("send back: %d, want 200", code)
	}
	if reply["step_id"] != w.steps["Write the proposal"] || reply["order_id"] != order || reply["role_name"] != "Lead" {
		t.Errorf("send back answered %v, want the proposal step, run %s and role Lead", reply, order)
	}

	if w.waitingFor(t, w.people["Director"], "Approval for submission") != nil {
		t.Errorf("the director still has the approval step open after sending it back")
	}
	reopened := w.waitingFor(t, w.people["Lead"], "Write the proposal")
	if reopened == nil {
		t.Fatalf("the lead does not find the proposal step open again: %+v", w.available(t, w.people["Lead"]))
	}
	if reopened["order_id"] != order {
		t.Errorf("the reopened step is in run %v, want %s", reopened["order_id"], order)
	}
	note, _ := reopened["sent_back"].(map[string]any)
	if note["reason"] != "The budget is missing" || note["role_name"] != "Director" {
		t.Errorf("sent_back = %v, want the reason and the role Director", reopened["sent_back"])
	}
	if at, _ := note["at"].(string); at == "" {
		t.Errorf("sent_back carries no time: %v", note)
	} else {
		requireRecentUTC(t, at)
	}
	answers, _ := note["answers"].(map[string]any)
	if answers["Summary"] != "Clean water for six villages" {
		t.Errorf("sent_back answers = %v, want the answers she gave", note["answers"])
	}

	again := w.submit(t, w.people["Lead"], "Write the proposal", map[string]string{"Summary": "Clean water, with a budget"}, order)
	if again.Code != http.StatusCreated {
		t.Fatalf("the lead sends the proposal again: %d %s", again.Code, again.Body.String())
	}
	back := w.waitingFor(t, w.people["Director"], "Approval for submission")
	if back == nil {
		t.Fatalf("the director gets no approval step after the proposal is sent again")
	}
	if back["sent_back"] != nil {
		t.Errorf("the approval step carries sent_back %v", back["sent_back"])
	}
	if w.waitingFor(t, w.people["Lead"], "Write the proposal") != nil {
		t.Errorf("the proposal step stays open after it was sent again")
	}
}

func TestASendBackReachesOnlyTheStepBeforeIt(t *testing.T) {
	w := newStepRunWalk(t, chainedProposalPlan(), "Lead", "Finance", "Director")
	order := w.startedRun(t, chainedProposalPlan(), map[string]map[string]string{
		"Write the proposal": {"Summary": "Clean water"},
		"Check the budget":   {"Budget fits": "yes"},
	})
	if code, _ := w.sendBack(t, w.people["Director"], "Approval for submission", map[string]any{"order_id": order, "reason": "Check the numbers again"}); code != http.StatusOK {
		t.Fatalf("send back: %d, want 200", code)
	}
	if w.waitingFor(t, w.people["Finance"], "Check the budget") == nil {
		t.Errorf("finance does not find the budget step open again")
	}
	if w.waitingFor(t, w.people["Lead"], "Write the proposal") != nil {
		t.Errorf("the proposal step reopened as well, a send back goes one step")
	}
	resent := w.submit(t, w.people["Finance"], "Check the budget", map[string]string{"Budget fits": "yes"}, order)
	if resent.Code != http.StatusCreated {
		t.Fatalf("finance sends the budget again: %d %s", resent.Code, resent.Body.String())
	}
	if w.waitingFor(t, w.people["Director"], "Approval for submission") == nil {
		t.Errorf("the director does not get the approval step again")
	}
}

func TestOnlyAStepThatCanBeSentBackCarriesSendBackAndOnlyWhenThereIsAStepBefore(t *testing.T) {
	w := newStepRunWalk(t, proposalPlan(), "Lead", "Director")
	for _, item := range w.available(t, w.people["Director"]) {
		if item["send_back"] != nil {
			t.Errorf("the approval step carries send_back %v before any run reached it", item["send_back"])
		}
	}
	listed := w.call(t, "GET", "/instances/"+w.instance+"/my-open-steps", nil, w.people["Director"])
	if listed.Code != http.StatusOK {
		t.Fatalf("my-open-steps: %d %s", listed.Code, listed.Body.String())
	}
	found := false
	for _, item := range decodeObjects(t, listed) {
		if item["id"] == w.steps["Approval for submission"] {
			found = true
			if item["send_back"] == nil {
				t.Errorf("the plain open steps do not say the approval step can be sent back: %v", item)
			}
		}
	}
	if !found {
		t.Fatalf("the approval step is not among the director's open steps")
	}
	for _, item := range w.available(t, w.people["Lead"]) {
		if item["send_back"] != nil {
			t.Errorf("the first step carries send_back %v", item["send_back"])
		}
	}
}

func TestASendBackIsRefusedForTheWrongRoleAnUnknownStepAndAStepThatCannotBeSentBack(t *testing.T) {
	w := newStepRunWalk(t, proposalPlan(), "Lead", "Director")
	order := w.startedRun(t, proposalPlan(), map[string]map[string]string{"Write the proposal": {"Summary": "Clean water"}})
	body := map[string]any{"order_id": order, "reason": "No"}

	if code, _ := w.sendBack(t, w.people["Lead"], "Approval for submission", body); code != http.StatusForbidden {
		t.Errorf("the lead sending the director's step back: %d, want 403", code)
	}
	if code, _ := w.sendBack(t, w.people["Director"], "Write the proposal", body); code != http.StatusNotFound {
		t.Errorf("sending back a step that declares no send back: %d, want 404", code)
	}
	missing := w.call(t, "POST", "/instances/"+w.instance+"/steps/no-such-step/send-back", body, w.people["Director"])
	if missing.Code != http.StatusNotFound {
		t.Errorf("sending back an unknown step: %d, want 404", missing.Code)
	}
	if w.waitingFor(t, w.people["Director"], "Approval for submission") == nil {
		t.Errorf("a refused send back changed the run")
	}
}

func TestASendBackIsRefusedWhenTheRunIsNotWaitingOrWasAlreadySentBack(t *testing.T) {
	w := newStepRunWalk(t, proposalPlan(), "Lead", "Director")
	order := w.startedRun(t, proposalPlan(), map[string]map[string]string{"Write the proposal": {"Summary": "Clean water"}})

	if code, _ := w.sendBack(t, w.people["Director"], "Approval for submission", map[string]any{"order_id": "no-such-run", "reason": "No"}); code != http.StatusConflict {
		t.Errorf("sending back a run that does not exist: %d, want 409", code)
	}
	if code, _ := w.sendBack(t, w.people["Director"], "Approval for submission", map[string]any{"order_id": order, "reason": "No", "send_key": "k-1"}); code != http.StatusOK {
		t.Fatalf("send back: %d, want 200", code)
	}
	if code, _ := w.sendBack(t, w.people["Director"], "Approval for submission", map[string]any{"order_id": order, "reason": "No", "send_key": "k-1"}); code != http.StatusConflict {
		t.Errorf("sending the same step back twice: %d, want 409", code)
	}
}

func TestASendBackFromTheFirstStepOfARunHasNowhereToGo(t *testing.T) {
	plan := []stepSpec{
		{title: "Approval for submission", form: "Approval for submission", role: "Director", questions: reviewQuestions(), sendBackDecision: sendBackDecisionPrompt, sendBackReason: sendBackReasonPrompt},
		{title: "File the proposal", form: "Filing", role: "Lead", questions: proposalQuestions()},
	}
	w := newStepRunWalk(t, plan, "Lead", "Director")
	if code, _ := w.sendBack(t, w.people["Director"], "Approval for submission", map[string]any{"order_id": "run-1", "reason": "No"}); code != http.StatusConflict {
		t.Errorf("sending back the first step: %d, want 409", code)
	}
}

func TestASendBackNeedsAReasonAndARun(t *testing.T) {
	w := newStepRunWalk(t, proposalPlan(), "Lead", "Director")
	order := w.startedRun(t, proposalPlan(), map[string]map[string]string{"Write the proposal": {"Summary": "Clean water"}})

	for name, body := range map[string]map[string]any{
		"no reason":       {"order_id": order},
		"a blank reason":  {"order_id": order, "reason": "   "},
		"no run named":    {"reason": "No"},
		"an empty body":   {},
		"an empty reason": {"order_id": order, "reason": ""},
	} {
		if code, _ := w.sendBack(t, w.people["Director"], "Approval for submission", body); code != http.StatusBadRequest {
			t.Errorf("%s: %d, want 400", name, code)
		}
	}
	if w.waitingFor(t, w.people["Director"], "Approval for submission") == nil {
		t.Errorf("a refused send back changed the run")
	}
}

func TestASendBackLeavesOneAuditEntryNamingTheSender(t *testing.T) {
	w := newStepRunWalk(t, proposalPlan(), "Lead", "Director")
	order := w.startedRun(t, proposalPlan(), map[string]map[string]string{"Write the proposal": {"Summary": "Clean water"}})
	if code, _ := w.sendBack(t, w.people["Director"], "Approval for submission", map[string]any{"order_id": order, "reason": "No"}); code != http.StatusOK {
		t.Fatalf("send back: %d, want 200", code)
	}
	entries, err := w.deps.Audit.ListEntries(t.Context(), mwanachamaaudit.EntryFilter{InstanceID: w.instance})
	if err != nil {
		t.Fatalf("ListEntries: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("a send back left %d audit entries, want 1: %+v", len(entries), entries)
	}
	if entries[0].Actor != w.subjects["Director"] || !strings.Contains(entries[0].Action, "sent") || !strings.Contains(entries[0].Action, "back") {
		t.Errorf("the audit entry = %+v, want the director's id and words that say a step was sent back", entries[0])
	}
}

func TestTheSendBackToolDoesWhatTheRouteDoes(t *testing.T) {
	w := newStepRunWalk(t, proposalPlan(), "Lead", "Director")
	order := w.startedRun(t, proposalPlan(), map[string]map[string]string{"Write the proposal": {"Summary": "Clean water"}})
	caller := designAgentWalk{stepRunWalk: w}

	refused := caller.mcpCall(t, w.subjects["Lead"], sendBackStepTool, map[string]any{"instance_id": w.instance, "step_id": w.steps["Approval for submission"], "order_id": order, "reason": "No"})
	if !refused.IsError {
		t.Errorf("the lead sending the director's step back through the tool was not refused")
	}
	sent := caller.mcpCall(t, w.subjects["Director"], sendBackStepTool, map[string]any{"instance_id": w.instance, "step_id": w.steps["Approval for submission"], "order_id": order, "reason": "The budget is missing"})
	if sent.IsError {
		t.Fatalf("the tool sends the step back: %s", toolErrorText(sent))
	}
	body, _ := sent.StructuredContent.(map[string]any)
	if body["step_id"] != w.steps["Write the proposal"] || body["order_id"] != order || body["role_name"] != "Lead" {
		t.Errorf("the tool answered %v, want the proposal step, run %s and role Lead", body, order)
	}
	if w.waitingFor(t, w.people["Lead"], "Write the proposal") == nil {
		t.Errorf("the lead does not find the proposal step open after the tool sent it back")
	}
	entries, err := w.deps.Audit.ListEntries(t.Context(), mwanachamaaudit.EntryFilter{InstanceID: w.instance})
	if err != nil {
		t.Fatalf("ListEntries: %v", err)
	}
	if len(entries) != 1 {
		t.Errorf("the tool left %d audit entries, want 1: %+v", len(entries), entries)
	}
}

func TestTheSendBackToolIsNamedAndOpenToSeatedMembers(t *testing.T) {
	if LocalActions()[sendBackStepTool] != sendBackStepAction {
		t.Errorf("the tool %s does not name its action", sendBackStepTool)
	}
	if !everySeatedAgentMay(sendBackStepAction) {
		t.Errorf("a seated member may not call %s", sendBackStepAction)
	}
}

func TestThePreviousStepIsTheNearestEarlierFillFormStepTheRunSent(t *testing.T) {
	link := func(kind agencymodels.StepKind) formStep {
		return formStep{step: agencymodels.WorkItem{Kind: kind}}
	}
	chain := []formStep{link(agencymodels.StepKindFillForm), link(agencymodels.StepKindSendForm), link(agencymodels.StepKindFillForm), link(agencymodels.StepKindFillForm), link(agencymodels.StepKindFillForm)}
	for name, tc := range map[string]struct {
		done  []bool
		index int
		want  int
	}{
		"the step right before":           {done: []bool{true, true, true, true, false}, index: 4, want: 3},
		"skips a step the run never sent": {done: []bool{true, true, true, false, false}, index: 4, want: 2},
		"skips a send_form step":          {done: []bool{true, true, false, false, false}, index: 3, want: 0},
		"nothing sent before":             {done: []bool{false, false, false, false, false}, index: 4, want: -1},
		"the first step":                  {done: []bool{false, false, false, false, false}, index: 0, want: -1},
	} {
		if got := previousStepOf(chain, stepRun{done: tc.done}, tc.index); got != tc.want {
			t.Errorf("%s: previousStepOf = %d, want %d", name, got, tc.want)
		}
	}
}
