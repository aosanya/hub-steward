package http

import (
	"encoding/json"
	"net/http"
	"testing"
)

func (w groupRoleWalk) askOnIssue(t *testing.T, issue, title string) string {
	t.Helper()
	body := map[string]any{"kind": "question", "title": title, "priority": "P2", "target_role": "R-1"}
	rec := w.call(t, "POST", w.tm("/rules"), body, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("ask %q: %d %s", title, rec.Code, rec.Body.String())
	}
	code, _ := decodeObject(t, rec)["code"].(string)
	link := map[string]any{"issue_id": issue, "relation": "applies_to"}
	if got := w.call(t, "POST", w.tm("/rules/"+code+"/links"), link, w.owner).Code; got != http.StatusNoContent {
		t.Fatalf("link %s to the issue: %d", code, got)
	}
	return code
}

func (w groupRoleWalk) questionCodesOfIssue(t *testing.T, issue, query string) []string {
	t.Helper()
	rec := w.call(t, "GET", w.tm("/tasks/"+issue+"/rules"+query), nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("list the rules of the issue%s: %d %s", query, rec.Code, rec.Body.String())
	}
	var out struct {
		Questions []struct {
			Code string `json:"code"`
		} `json:"questions"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	codes := []string{}
	for _, question := range out.Questions {
		codes = append(codes, question.Code)
	}
	return codes
}

func sameCodes(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	seen := map[string]bool{}
	for _, code := range got {
		seen[code] = true
	}
	for _, code := range want {
		if !seen[code] {
			return false
		}
	}
	return true
}

func TestTheQuestionsOfAnIssueAreTheOpenOnesUnlessAStatusIsAsked(t *testing.T) {
	w := newGroupRoleWalk(t)
	issue := w.journeyIssue(t, "backlog", "doing")
	open := w.askOnIssue(t, issue, "Which clinic?")
	settled := w.askOnIssue(t, issue, "Which day?")
	dropped := w.askOnIssue(t, issue, "Which colour?")

	answer := map[string]any{"other": "Tuesday"}
	if got := w.call(t, "PUT", w.tm("/rules/"+settled+"/answer"), answer, w.owner).Code; got != http.StatusOK {
		t.Fatalf("answer %s: %d", settled, got)
	}
	if got := w.call(t, "PUT", w.tm("/rules/"+dropped+"/status"), map[string]any{"status": "dropped"}, w.owner).Code; got != http.StatusOK {
		t.Fatalf("drop %s: %d", dropped, got)
	}

	if got := w.questionCodesOfIssue(t, issue, ""); !sameCodes(got, []string{open}) {
		t.Errorf("no status = %v, want only the open %s", got, open)
	}
	if got := w.questionCodesOfIssue(t, issue, "?status=answered&status=dropped"); !sameCodes(got, []string{settled, dropped}) {
		t.Errorf("answered and dropped = %v, want %s and %s", got, settled, dropped)
	}
	if got := w.questionCodesOfIssue(t, issue, "?status=open&status=answered&status=dropped"); !sameCodes(got, []string{open, settled, dropped}) {
		t.Errorf("all three statuses = %v, want every question once", got)
	}
	if got := w.call(t, "GET", w.tm("/tasks/"+issue+"/rules?status=bogus"), nil, w.owner).Code; got != http.StatusBadRequest {
		t.Errorf("a bad status = %d, want 400", got)
	}
}
