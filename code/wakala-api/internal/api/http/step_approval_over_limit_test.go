package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func mayorPlan() []stepSpec {
	plan := approvalPlan()
	plan[1].approvesAbove = true
	return plan
}

func mayorWalk(t *testing.T) stepRunWalk {
	t.Helper()
	return newStepRunWalk(t, mayorPlan(), "Clerk", "Cashier")
}

func (w stepRunWalk) lastRowAnswers(t *testing.T) map[string]string {
	t.Helper()
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	rows, err := mgr.ListRecordRows(context.Background(), w.draftID, mwanachamaagency.RecordRowFilter{})
	if err != nil || len(rows) == 0 {
		t.Fatalf("ListRecordRows = %v %v", rows, err)
	}
	var latest agencymodels.RecordRow
	for _, row := range rows {
		if w.promptsOfRow(t, row)["Amount"] != "" {
			latest = row
		}
	}
	return w.promptsOfRow(t, latest)
}

func TestARoleThatMayApproveAboveItsLimitSendsAnAmountAboveItAndTheRowIsFlagged(t *testing.T) {
	w := mayorWalk(t)
	mayor := w.approver(t, "Mayor", intp(500000))
	order := w.raiseClaim(t)

	rec := w.approveAmount(t, mayor.cookie, order, "900000")
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d %s, want 201", rec.Code, rec.Body.String())
	}
	answers := w.lastRowAnswers(t)
	if answers["Approved over the limit"] != "yes" || answers["Limit that applied"] != "500000" {
		t.Fatalf("answers = %v, want the flag and the limit that applied", answers)
	}
}

func TestAnAmountWithinTheLimitOfARoleThatMayCarriesNoFlag(t *testing.T) {
	w := mayorWalk(t)
	mayor := w.approver(t, "Mayor", intp(500000))
	order := w.raiseClaim(t)

	if rec := w.approveAmount(t, mayor.cookie, order, "400000"); rec.Code != http.StatusCreated {
		t.Fatalf("status = %d %s, want 201", rec.Code, rec.Body.String())
	}
	answers := w.lastRowAnswers(t)
	if _, flagged := answers["Approved over the limit"]; flagged {
		t.Fatalf("answers = %v, want no flag within the limit", answers)
	}
}

func TestARoleThatMayNotApproveAboveItsLimitStaysRefused(t *testing.T) {
	w := approvalWalk(t)
	clerk := w.approver(t, "Approver", intp(500000))
	order := w.raiseClaim(t)

	rec := w.approveAmount(t, clerk.cookie, order, "900000")
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d %s, want 422", rec.Code, rec.Body.String())
	}
}

func TestTheFlagCannotBeAnsweredByHand(t *testing.T) {
	w := mayorWalk(t)
	mayor := w.approver(t, "Mayor", intp(500000))
	order := w.raiseClaim(t)

	rec := w.submit(t, mayor.cookie, "Approve the amount", map[string]string{"Amount": "100000", "Approved over the limit": "yes"}, order)
	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d %s, want a refusal", rec.Code, rec.Body.String())
	}
}
