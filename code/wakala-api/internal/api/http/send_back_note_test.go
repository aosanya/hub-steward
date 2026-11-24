package http

import (
	"net/http"
	"testing"
)

func TestTheHolderOfAReopenedStepReadsTheSendBackReasonWithNoViewCode(t *testing.T) {
	w := newStepRunWalk(t, chainedProposalPlan(), "Lead", "Finance", "Director")
	order := w.startedRun(t, chainedProposalPlan(), map[string]map[string]string{
		"Write the proposal": {"Summary": "Clean water for six villages"},
		"Check the budget":   {"Budget fits": "no"},
	})
	if code, _ := w.sendBack(t, w.people["Director"], "Approval for submission", map[string]any{"order_id": order, "reason": "The budget is wrong"}); code != http.StatusOK {
		t.Fatalf("send back: %d", code)
	}
	w.holdingOnly("Finance")

	reopened := w.waitingFor(t, w.people["Finance"], "Check the budget")
	if reopened == nil {
		t.Fatalf("finance does not find the budget step open: %+v", w.available(t, w.people["Finance"]))
	}
	note, _ := reopened["sent_back"].(map[string]any)
	if note["reason"] != "The budget is wrong" {
		t.Errorf("sent_back = %v, want the reason whatever finance may view", reopened["sent_back"])
	}
}

func TestAPersonWhoHoldsNeitherTheStepNorSentItBackDoesNotReadTheSendBackReason(t *testing.T) {
	w := newStepRunWalk(t, chainedProposalPlan(), "Lead", "Finance", "Director")
	order := w.startedRun(t, chainedProposalPlan(), map[string]map[string]string{
		"Write the proposal": {"Summary": "Clean water for six villages"},
		"Check the budget":   {"Budget fits": "no"},
	})
	if code, _ := w.sendBack(t, w.people["Director"], "Approval for submission", map[string]any{"order_id": order, "reason": "The budget is wrong"}); code != http.StatusOK {
		t.Fatalf("send back: %d", code)
	}

	for _, item := range w.available(t, w.people["Lead"]) {
		if item["sent_back"] != nil {
			t.Errorf("the lead reads %v on %v", item["sent_back"], item["title"])
		}
	}
}
