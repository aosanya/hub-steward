package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func partialAddQuestions(closingRequired bool) []agencymodels.StepQuestion {
	return []agencymodels.StepQuestion{
		{Prompt: "Issuer", AnswerType: agencymodels.AnswerFreeText, Required: !closingRequired},
		{Prompt: "Closing date", AnswerType: agencymodels.AnswerFreeText, Required: closingRequired},
		{Prompt: "Estimated value", AnswerType: agencymodels.AnswerFreeText},
	}
}

func newPartialAddWalk(t *testing.T, closingRequired bool) reachWalk {
	t.Helper()
	shape := func(w stepRunWalk, r *agencymodels.Record) { r.Questions = partialAddQuestions(closingRequired) }
	return reachWalk{rowStepWalk: newRowStepWalk(t, shape)}
}

func (w reachWalk) directAdd(t *testing.T, as *http.Cookie, answers map[string]string) int {
	t.Helper()
	return w.directAddResponse(t, as, answers).Code
}

func (w reachWalk) directAddResponse(t *testing.T, as *http.Cookie, answers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	return w.call(t, "POST", "/instances/"+w.instance+"/live-records/"+w.record.Key+"/rows", map[string]any{"answers": answers}, as)
}

func (w reachWalk) stepAdd(t *testing.T, as *http.Cookie, answers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	return w.send(t, as, "add", map[string]any{"answers": answers})
}

func (w reachWalk) ownerSeatedAs(t *testing.T, role string) {
	t.Helper()
	seated := w.groupCarrying(t, "Owner seat "+role, "emea")
	w.grantSeat(t, "test-owner", seated, w.roles[role])
	w.assumeDirectly(t, w.owner, "test-owner", seated)
}

func (w reachWalk) storedRows(t *testing.T) []map[string]string {
	t.Helper()
	rows, err := w.manager.ListRecordRows(context.Background(), w.liveID, mwanachamaagency.RecordRowFilter{RecordCode: w.record.Code})
	if err != nil {
		t.Fatalf("ListRecordRows: %v", err)
	}
	stored := []map[string]string{}
	for _, row := range rows {
		stored = append(stored, w.promptsOfRow(t, row))
	}
	return stored
}

func wantOnlyStored(t *testing.T, who string, stored []map[string]string, want map[string]string) {
	t.Helper()
	if len(stored) != 1 {
		t.Fatalf("%s stored %d rows, want 1: %v", who, len(stored), stored)
	}
	for prompt, value := range stored[0] {
		if value != "" && want[prompt] != value {
			t.Errorf("%s stored %q for %s, want %q", who, value, prompt, want[prompt])
		}
	}
	for prompt, value := range want {
		if stored[0][prompt] != value {
			t.Errorf("%s stored %q for %s, want %q", who, stored[0][prompt], prompt, value)
		}
	}
}

var everyPartialAnswer = map[string]string{"Issuer": "Ministry of Works", "Closing date": "2026-12-01", "Estimated value": "90000"}

var issuerAndClosingDate = map[string]string{"Issuer": "Ministry of Works", "Closing date": "2026-12-01"}

func TestAGeneratedAddStoresTheFieldsTheRoleMayAddAndLeavesTheRestEmpty(t *testing.T) {
	w := newPartialAddWalk(t, false)
	w.roleCarrying(t, "Clerk", "add.issuer", "add.closing_date")
	clerk := w.personWith(t, "clerk", "Clerk")

	if rec := w.stepAdd(t, clerk, issuerAndClosingDate); rec.Code != http.StatusCreated {
		t.Fatalf("a partial add through the step: %d %s, want 201", rec.Code, rec.Body.String())
	}
	wantOnlyStored(t, "the clerk", w.storedRows(t), issuerAndClosingDate)
}

func TestADirectAddStoresTheFieldsTheRoleMayAddAndLeavesTheRestEmpty(t *testing.T) {
	w := newPartialAddWalk(t, false)
	w.roleCarrying(t, "Clerk", "add.issuer", "add.closing_date")
	w.ownerSeatedAs(t, "Clerk")

	if code := w.directAdd(t, w.owner, issuerAndClosingDate); code != http.StatusCreated {
		t.Fatalf("a partial direct add: %d, want 201", code)
	}
	wantOnlyStored(t, "the clerk", w.storedRows(t), issuerAndClosingDate)
}

func TestAnAddWithEveryCodeStoresEveryField(t *testing.T) {
	w := newPartialAddWalk(t, true)
	w.roleCarrying(t, "Chief", "add.*")
	chief := w.personWith(t, "chief", "Chief")

	if rec := w.stepAdd(t, chief, everyPartialAnswer); rec.Code != http.StatusCreated {
		t.Fatalf("an add with add.*: %d %s, want 201", rec.Code, rec.Body.String())
	}
	wantOnlyStored(t, "the chief", w.storedRows(t), everyPartialAnswer)
}

func TestAnAddNeedsNoViewOfTheFieldsItStores(t *testing.T) {
	w := newPartialAddWalk(t, false)
	w.roleCarrying(t, "Blind clerk", "add.issuer")
	clerk := w.personWith(t, "blind-clerk", "Blind clerk")

	if rec := w.stepAdd(t, clerk, map[string]string{"Issuer": "Ministry of Works"}); rec.Code != http.StatusCreated {
		t.Fatalf("an add with add.issuer and no view: %d %s, want 201", rec.Code, rec.Body.String())
	}
	wantOnlyStored(t, "the blind clerk", w.storedRows(t), map[string]string{"Issuer": "Ministry of Works"})
}

func TestAnAddRefusesARequiredFieldTheRoleCannotAddAndNamesIt(t *testing.T) {
	w := newPartialAddWalk(t, true)
	w.roleCarrying(t, "Issuer clerk", "add.issuer")
	w.ownerSeatedAs(t, "Issuer clerk")
	clerk := w.personWith(t, "issuer-clerk", "Issuer clerk")
	answers := map[string]string{"Issuer": "Ministry of Works", "Closing date": "2026-12-01"}

	step := w.stepAdd(t, clerk, answers)
	direct := w.directAddResponse(t, w.owner, answers)
	for who, rec := range map[string]*httptest.ResponseRecorder{"the step": step, "the direct add": direct} {
		if rec.Code != http.StatusBadRequest && rec.Code != http.StatusForbidden {
			t.Errorf("%s with a required field the role cannot add: %d %s, want a refusal", who, rec.Code, rec.Body.String())
		}
		if !strings.Contains(rec.Body.String(), "Closing date") {
			t.Errorf("%s refusal %q does not name Closing date", who, rec.Body.String())
		}
	}
	if stored := w.storedRows(t); len(stored) != 0 {
		t.Errorf("a refused add stored %v, want no row", stored)
	}
}

func TestAnAddWithTheRequiredFieldCodeIsAccepted(t *testing.T) {
	w := newPartialAddWalk(t, true)
	w.roleCarrying(t, "Dated clerk", "add.closing_date")
	clerk := w.personWith(t, "dated-clerk", "Dated clerk")

	if rec := w.stepAdd(t, clerk, map[string]string{"Closing date": "2026-12-01"}); rec.Code != http.StatusCreated {
		t.Fatalf("an add with add.closing_date: %d %s, want 201", rec.Code, rec.Body.String())
	}
	wantOnlyStored(t, "the dated clerk", w.storedRows(t), map[string]string{"Closing date": "2026-12-01"})
}

func TestAnAddSendingAFieldTheRoleCannotAddIsRefusedNamingItAndStoresNothing(t *testing.T) {
	w := newPartialAddWalk(t, false)
	w.roleCarrying(t, "Clerk", "add.issuer", "add.closing_date")
	w.ownerSeatedAs(t, "Clerk")
	clerk := w.personWith(t, "clerk", "Clerk")

	step := w.stepAdd(t, clerk, everyPartialAnswer)
	direct := w.directAddResponse(t, w.owner, everyPartialAnswer)
	for who, rec := range map[string]*httptest.ResponseRecorder{"the step": step, "the direct add": direct} {
		if rec.Code != http.StatusBadRequest && rec.Code != http.StatusForbidden {
			t.Errorf("%s sending Estimated value without its add code: %d %s, want a refusal", who, rec.Code, rec.Body.String())
		}
		if !strings.Contains(rec.Body.String(), "Estimated value") {
			t.Errorf("%s refusal %q does not name Estimated value", who, rec.Body.String())
		}
	}
	if stored := w.storedRows(t); len(stored) != 0 {
		t.Errorf("a refused add stored %v, want no row", stored)
	}
}

func TestAnAddWithAnEmptyValueForAFieldTheRoleCannotAddIsAccepted(t *testing.T) {
	w := newPartialAddWalk(t, false)
	w.roleCarrying(t, "Clerk", "add.issuer")
	clerk := w.personWith(t, "clerk", "Clerk")

	if rec := w.stepAdd(t, clerk, map[string]string{"Issuer": "Ministry of Works", "Estimated value": ""}); rec.Code != http.StatusCreated {
		t.Fatalf("an add with an empty value for a field it cannot add: %d %s, want 201", rec.Code, rec.Body.String())
	}
	wantOnlyStored(t, "the clerk", w.storedRows(t), map[string]string{"Issuer": "Ministry of Works"})
}
