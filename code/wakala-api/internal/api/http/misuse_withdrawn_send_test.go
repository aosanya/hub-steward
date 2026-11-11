package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"wakalaserver/internal/agencies"
)

func TestWithdrawnResidentIsNotListedToTheClerkAsHavingSentAForm(t *testing.T) {
	cw := newConsentWalk(t)
	publishMechanicsConsent(t, cw)
	formID, questionID := openFormForGroup(t, cw)
	base := "/instances/" + cw.instance + "/forms/forms"

	agreed := cw.call(t, "POST", "/instances/"+cw.instance+"/custody/consent/agree", map[string]any{}, cw.resident)
	if agreed.Code != http.StatusCreated {
		t.Fatalf("resident agrees: %d %s", agreed.Code, agreed.Body.String())
	}
	sent := cw.call(t, "POST", base+"/"+formID+"/answers",
		map[string]any{"answers": []map[string]any{{"question_id": questionID, "value_text": "secret"}}}, cw.resident)
	if sent.Code != http.StatusOK {
		t.Fatalf("resident sends: %d %s", sent.Code, sent.Body.String())
	}

	listed := func(path string, who *http.Cookie) string {
		t.Helper()
		got := cw.call(t, "GET", base+path, nil, who)
		if got.Code != http.StatusOK {
			t.Fatalf("GET %s: %d %s", path, got.Code, got.Body.String())
		}
		return got.Body.String()
	}
	respondents := func() int {
		t.Helper()
		var page struct {
			Respondents int `json:"respondents"`
		}
		if err := json.Unmarshal([]byte(listed("", cw.owner)), &page); err != nil {
			t.Fatalf("register page: %v", err)
		}
		return page.Respondents
	}
	if body := listed("/"+formID+"/submissions", cw.owner); !strings.Contains(body, cw.actorID) {
		t.Fatalf("before the withdrawal the clerk's submissions do not name the resident: %s", body)
	}
	if got := respondents(); got != 1 {
		t.Fatalf("respondents before the withdrawal = %d, want 1", got)
	}

	withdrawn := cw.call(t, "POST", "/instances/"+cw.instance+"/custody/consent/withdraw", map[string]any{}, cw.resident)
	if withdrawn.Code != http.StatusCreated {
		t.Fatalf("resident withdraws: %d %s", withdrawn.Code, withdrawn.Body.String())
	}

	if body := listed("/"+formID+"/answers", cw.owner); strings.Contains(body, "secret") || strings.Contains(body, cw.actorID) {
		t.Fatalf("clerk's answers still show the withdrawn resident: %s", body)
	}
	if body := listed("/"+formID+"/submissions", cw.owner); strings.Contains(body, cw.actorID) {
		t.Fatalf("clerk's submissions still name the withdrawn resident: %s", body)
	}
	if got := respondents(); got != 0 {
		t.Fatalf("respondents after the withdrawal = %d, want 0", got)
	}
	paid := cw.call(t, "PUT", base+"/"+formID+"/submissions/"+cw.actorID+"/paid", map[string]any{"paid": true}, cw.owner)
	if paid.Code < 400 {
		t.Fatalf("clerk marked a withdrawn resident's send paid: %d %s", paid.Code, paid.Body.String())
	}

	reader, ok := cw.reg.(agencies.WithdrawalReader)
	if !ok {
		t.Fatal("the registry does not read withdrawn rows")
	}
	hidden, err := reader.HiddenRowsOf(context.Background(), cw.instance, cw.actorID)
	if err != nil {
		t.Fatalf("HiddenRowsOf: %v", err)
	}
	if len(hidden.Sends) != 1 || hidden.Sends[0].MemberID != cw.actorID || hidden.Sends[0].WithdrawnAt == "" {
		t.Fatalf("a legal request cannot produce the hidden send: %+v", hidden.Sends)
	}

	if err := reader.RestoreWithdrawn(context.Background(), cw.instance, cw.actorID); err != nil {
		t.Fatalf("RestoreWithdrawn: %v", err)
	}
	if body := listed("/"+formID+"/submissions", cw.owner); !strings.Contains(body, cw.actorID) {
		t.Fatalf("the restored send is not listed to the clerk again: %s", body)
	}
	if got := respondents(); got != 1 {
		t.Fatalf("respondents after the restore = %d, want 1", got)
	}
}
