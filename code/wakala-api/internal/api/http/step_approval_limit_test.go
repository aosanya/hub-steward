package http

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	"wakalaserver/internal/agencies"
)

var approvalDesks atomic.Int64

type limitedStep struct {
	Title         string `json:"title"`
	State         string `json:"state"`
	OrderID       string `json:"order_id"`
	ApprovalLimit *struct {
		Amount *int `json:"amount"`
	} `json:"approval_limit"`
}

func approvalPlan() []stepSpec {
	return []stepSpec{
		{title: "Raise the claim", form: "Claim", role: "Clerk", questions: []agencymodels.StepQuestion{
			{Prompt: "Reason", AnswerType: agencymodels.AnswerFreeText, Required: true},
		}},
		{title: "Approve the amount", form: "Payout", role: "Approver", questions: []agencymodels.StepQuestion{
			{Prompt: "Amount", AnswerType: agencymodels.AnswerCurrency, Required: true, ChecksApprovalLimit: true},
		}},
		{title: "Pay out", form: "Payment", role: "Cashier", questions: []agencymodels.StepQuestion{
			{Prompt: "Paid", AnswerType: agencymodels.AnswerYesNo, Required: true},
		}},
	}
}

func intp(n int) *int { return &n }

func approvalWalk(t *testing.T) stepRunWalk {
	t.Helper()
	return newStepRunWalk(t, approvalPlan(), "Clerk", "Cashier")
}

type approverSeat struct {
	cookie       *http.Cookie
	actorID      string
	assignmentID []string
	desks        []string
}

func (w stepRunWalk) assumeDesk(t *testing.T, seat approverSeat, desk int) {
	t.Helper()
	w.assumeDirectly(t, seat.cookie, seat.actorID, seat.desks[desk])
}

func (w stepRunWalk) approver(t *testing.T, name string, limits ...*int) approverSeat {
	t.Helper()
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	role, err := mgr.GetRole(ctx, w.roles["Approver"])
	if err != nil {
		t.Fatalf("GetRole: %v", err)
	}
	kind, err := um.RoleKindForDefinitionRole(ctx, definitionRoleID(agencymodels.DocumentRole{ID: role.ID, Code: role.Code}))
	if err != nil {
		t.Fatalf("RoleKindForDefinitionRole: %v", err)
	}
	seat := approverSeat{cookie: w.cookieFor(t, actor.ID), actorID: actor.ID}
	for _, limit := range limits {
		desk := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": fmt.Sprintf("Desk %d", approvalDesks.Add(1))}, w.owner)
		if desk.Code != http.StatusCreated {
			t.Fatalf("create desk: %d %s", desk.Code, desk.Body.String())
		}
		groupID, _ := decodeObject(t, desk)["id"].(string)
		w.tagGroup(t, groupID)
		granted, err := um.GrantRole(ctx, mwanachamaactor.ActorRoleAssignment{ActorID: actor.ID, GroupID: groupID, KindID: kind.ID, ApprovalLimit: limit})
		if err != nil {
			t.Fatalf("GrantRole: %v", err)
		}
		seat.assignmentID = append(seat.assignmentID, granted.ID)
		seat.desks = append(seat.desks, groupID)
		if len(seat.assignmentID) == 1 {
			w.assumeDirectly(t, seat.cookie, actor.ID, groupID)
		}
	}
	return seat
}

func (w stepRunWalk) raiseClaim(t *testing.T) string {
	t.Helper()
	rec := w.submit(t, w.people["Clerk"], "Raise the claim", map[string]string{"Reason": "Roof repair"}, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("raise the claim: %d %s", rec.Code, rec.Body.String())
	}
	order, _ := decodeObject(t, rec)["order_id"].(string)
	if order == "" {
		t.Fatalf("raise the claim returned no run: %s", rec.Body.String())
	}
	return order
}

func (w stepRunWalk) limitedSteps(t *testing.T, as *http.Cookie) []limitedStep {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-open-steps?available=true", nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("my-open-steps available: %d %s", rec.Code, rec.Body.String())
	}
	var out []limitedStep
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	return out
}

func (w stepRunWalk) approvalStep(t *testing.T, as *http.Cookie) limitedStep {
	t.Helper()
	for _, s := range w.limitedSteps(t, as) {
		if s.Title == "Approve the amount" {
			return s
		}
	}
	t.Fatalf("the approver does not see the step to approve the amount")
	return limitedStep{}
}

func (w stepRunWalk) rowCount(t *testing.T) int {
	t.Helper()
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	rows, err := mgr.ListRecordRows(context.Background(), w.draftID, mwanachamaagency.RecordRowFilter{})
	if err != nil {
		t.Fatalf("ListRecordRows: %v", err)
	}
	return len(rows)
}

func (w stepRunWalk) approveAmount(t *testing.T, as *http.Cookie, order, amount string) *httptest.ResponseRecorder {
	t.Helper()
	return w.submit(t, as, "Approve the amount", map[string]string{"Amount": amount}, order)
}

func errorOf(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	msg, _ := decodeObject(t, rec)["error"].(string)
	return msg
}

func TestTheStepShowsTheLimitOfTheDeskTheCallerAssumed(t *testing.T) {
	w := approvalWalk(t)
	limits := []int{200000, 500000, 350000}
	approver := w.approver(t, "Approver", intp(limits[0]), intp(limits[1]), intp(limits[2]))
	w.raiseClaim(t)

	for desk, want := range limits {
		w.assumeDesk(t, approver, desk)
		step := w.approvalStep(t, approver.cookie)
		if step.ApprovalLimit == nil || step.ApprovalLimit.Amount == nil || *step.ApprovalLimit.Amount != want {
			t.Fatalf("assuming desk %d: approval_limit = %+v, want amount %d", desk, step.ApprovalLimit, want)
		}
	}
}

func TestAnEndedSeatGivesNoStepAndLendsNoLimit(t *testing.T) {
	w := approvalWalk(t)
	approver := w.approver(t, "Approver", intp(900000), intp(100000))
	um, _ := w.deps.Registry.ActorManager(context.Background(), w.instance)
	if err := um.RevokeRole(context.Background(), approver.assignmentID[0]); err != nil {
		t.Fatalf("RevokeRole: %v", err)
	}
	w.raiseClaim(t)

	w.assumeDesk(t, approver, 0)
	for _, s := range w.limitedSteps(t, approver.cookie) {
		if s.Title == "Approve the amount" {
			t.Fatalf("assuming the desk whose seat ended still shows the step to approve the amount")
		}
	}
	w.assumeDesk(t, approver, 1)
	step := w.approvalStep(t, approver.cookie)
	if step.ApprovalLimit == nil || step.ApprovalLimit.Amount == nil || *step.ApprovalLimit.Amount != 100000 {
		t.Fatalf("approval_limit = %+v, want amount 100000 on the desk whose seat is live", step.ApprovalLimit)
	}
}

func TestASeatWithoutALimitMakesTheStepShowNoUpperLimit(t *testing.T) {
	cases := map[string][]*int{
		"one seat with no limit written":            {nil},
		"a limited desk beside one with no limit":   {intp(500000), nil},
		"no limit desk listed before a limited one": {nil, intp(500000)},
	}
	for name, limits := range cases {
		t.Run(name, func(t *testing.T) {
			w := approvalWalk(t)
			approver := w.approver(t, "Approver", limits...)
			w.raiseClaim(t)

			for desk, limit := range limits {
				w.assumeDesk(t, approver, desk)
				step := w.approvalStep(t, approver.cookie)
				if step.ApprovalLimit == nil {
					t.Fatalf("desk %d: approval_limit is absent, want it present", desk)
				}
				if limit == nil && step.ApprovalLimit.Amount != nil {
					t.Errorf("desk %d: approval_limit amount = %d, want none", desk, *step.ApprovalLimit.Amount)
				}
				if limit != nil && (step.ApprovalLimit.Amount == nil || *step.ApprovalLimit.Amount != *limit) {
					t.Errorf("desk %d: approval_limit = %+v, want %d", desk, step.ApprovalLimit, *limit)
				}
			}
		})
	}
}

func TestStepsWithoutALimitCheckedQuestionCarryNoApprovalLimit(t *testing.T) {
	w := approvalWalk(t)
	order := w.raiseClaim(t)

	clerk := w.available(t, w.people["Clerk"])
	if len(clerk) != 1 {
		t.Fatalf("the clerk sees %v, want her own step", clerk)
	}
	if _, has := clerk[0]["approval_limit"]; has {
		t.Errorf("a step with no limit-checked question carries approval_limit: %v", clerk[0])
	}

	approver := w.approver(t, "Approver", intp(500000))
	if rec := w.approveAmount(t, approver.cookie, order, "100000"); rec.Code != http.StatusCreated {
		t.Fatalf("approve: %d %s", rec.Code, rec.Body.String())
	}
	cashier := w.available(t, w.people["Cashier"])
	if len(cashier) != 1 {
		t.Fatalf("the cashier sees %v, want the pay out step", cashier)
	}
	if _, has := cashier[0]["approval_limit"]; has {
		t.Errorf("the pay out step carries approval_limit: %v", cashier[0])
	}
}

func TestAnAmountAboveTheLimitIsRefusedWithTheWholeSentenceAndWritesNothing(t *testing.T) {
	cases := []struct {
		name          string
		limit, amount string
		want          string
	}{
		{"720 000 against 500 000", "500000", "720000", "The amount 720 000 Ft is above the limit of 500 000 Ft written to your role. Another role must approve it."},
		{"one forint over", "500000", "500001", "The amount 500 001 Ft is above the limit of 500 000 Ft written to your role. Another role must approve it."},
		{"millions", "999999", "1250000", "The amount 1 250 000 Ft is above the limit of 999 999 Ft written to your role. Another role must approve it."},
		{"a small limit", "5000", "12000", "The amount 12 000 Ft is above the limit of 5 000 Ft written to your role. Another role must approve it."},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := approvalWalk(t)
			var limit int
			fmt.Sscan(c.limit, &limit)
			approver := w.approver(t, "Approver", intp(limit))
			order := w.raiseClaim(t)
			before := w.rowCount(t)

			rec := w.approveAmount(t, approver.cookie, order, c.amount)
			if rec.Code != http.StatusUnprocessableEntity {
				t.Fatalf("status = %d %s, want 422", rec.Code, rec.Body.String())
			}
			if got := errorOf(t, rec); got != c.want {
				t.Errorf("error = %q, want %q", got, c.want)
			}
			if after := w.rowCount(t); after != before {
				t.Errorf("a refused amount wrote %d record rows", after-before)
			}
			if step := w.approvalStep(t, approver.cookie); step.OrderID != order || step.State != "waiting" {
				t.Errorf("the step is no longer open after the refusal: %+v", step)
			}
			if got := titles(w.available(t, w.people["Cashier"])); len(got) != 0 {
				t.Errorf("the refused amount moved the run on: the cashier sees %v", got)
			}
		})
	}
}

func TestAnAmountEqualToOrBelowTheLimitGoesThrough(t *testing.T) {
	for _, amount := range []string{"500000", "499999", "1", "0"} {
		t.Run(amount, func(t *testing.T) {
			w := approvalWalk(t)
			approver := w.approver(t, "Approver", intp(500000))
			order := w.raiseClaim(t)
			before := w.rowCount(t)

			rec := w.approveAmount(t, approver.cookie, order, amount)
			if rec.Code != http.StatusCreated {
				t.Fatalf("status = %d %s, want 201", rec.Code, rec.Body.String())
			}
			if after := w.rowCount(t); after != before+1 {
				t.Errorf("record rows went from %d to %d, want one more", before, after)
			}
			if got := titles(w.available(t, w.people["Cashier"])); !sameTitles(got, []string{"Pay out"}) {
				t.Errorf("the cashier sees %v, want the run to reach her", got)
			}
		})
	}
}

func TestACallerWithNoLimitMaySendAnyAmount(t *testing.T) {
	w := approvalWalk(t)
	approver := w.approver(t, "Approver", nil)
	order := w.raiseClaim(t)

	rec := w.approveAmount(t, approver.cookie, order, "987654321")
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestTheLimitOfTheAssumedDeskDecidesWhatMaySend(t *testing.T) {
	w := approvalWalk(t)
	approver := w.approver(t, "Approver", intp(200000), intp(900000))
	order := w.raiseClaim(t)

	w.assumeDesk(t, approver, 0)
	small := w.approveAmount(t, approver.cookie, order, "700000")
	if small.Code != http.StatusUnprocessableEntity {
		t.Fatalf("700000 on the 200000 desk: status = %d %s, want 422", small.Code, small.Body.String())
	}
	if got, want := errorOf(t, small), "The amount 700 000 Ft is above the limit of 200 000 Ft written to your role. Another role must approve it."; got != want {
		t.Errorf("error = %q, want %q", got, want)
	}
	w.assumeDesk(t, approver, 1)
	over := w.approveAmount(t, approver.cookie, order, "950000")
	if over.Code != http.StatusUnprocessableEntity {
		t.Fatalf("950000 status = %d %s, want 422", over.Code, over.Body.String())
	}
	if got, want := errorOf(t, over), "The amount 950 000 Ft is above the limit of 900 000 Ft written to your role. Another role must approve it."; got != want {
		t.Errorf("error = %q, want %q", got, want)
	}
	if rec := w.approveAmount(t, approver.cookie, order, "700000"); rec.Code != http.StatusCreated {
		t.Fatalf("700000 status = %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestTheApproverIsTheSessionAndABodyCannotNameAnother(t *testing.T) {
	w := approvalWalk(t)
	small := w.approver(t, "Small approver", intp(100000))
	big := w.approver(t, "Big approver", intp(5000000))
	order := w.raiseClaim(t)
	before := w.rowCount(t)

	for _, field := range []string{"approver_id", "actor_id", "approver"} {
		body := map[string]any{"answers": map[string]string{"Amount": "720000"}, "order_id": order, field: big.actorID}
		rec := w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.steps["Approve the amount"]+"/answers", body, small.cookie)
		if rec.Code != http.StatusBadRequest && rec.Code != http.StatusUnprocessableEntity {
			t.Errorf("naming another approver in %q: %d %s, want 400 or 422", field, rec.Code, rec.Body.String())
		}
		if after := w.rowCount(t); after != before {
			t.Errorf("naming another approver in %q wrote %d record rows", field, after-before)
		}
	}

	plain := w.approveAmount(t, small.cookie, order, "720000")
	if plain.Code != http.StatusUnprocessableEntity {
		t.Fatalf("the small approver sending 720000: %d %s, want 422", plain.Code, plain.Body.String())
	}
	if got, want := errorOf(t, plain), "The amount 720 000 Ft is above the limit of 100 000 Ft written to your role. Another role must approve it."; got != want {
		t.Errorf("error = %q, want %q", got, want)
	}
	if rec := w.approveAmount(t, big.cookie, order, "720000"); rec.Code != http.StatusCreated {
		t.Errorf("the big approver sending 720000: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestAnAmountThatIsNotAPlainNonNegativeNumberIsRefused(t *testing.T) {
	for name, amount := range map[string]string{
		"words":            "a lot",
		"negative":         "-5000",
		"negative zero":    "-0.5",
		"letters in digit": "12k",
		"empty":            "",
	} {
		t.Run(name, func(t *testing.T) {
			w := approvalWalk(t)
			approver := w.approver(t, "Approver", intp(500000))
			order := w.raiseClaim(t)
			before := w.rowCount(t)

			rec := w.approveAmount(t, approver.cookie, order, amount)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d %s, want 400", rec.Code, rec.Body.String())
			}
			if after := w.rowCount(t); after != before {
				t.Errorf("a refused amount wrote %d record rows", after-before)
			}
		})
	}
}

func TestACallerWithNoLimitStillCannotSendANegativeOrNonNumericAmount(t *testing.T) {
	for _, amount := range []string{"-1", "many"} {
		w := approvalWalk(t)
		approver := w.approver(t, "Approver", nil)
		order := w.raiseClaim(t)
		if rec := w.approveAmount(t, approver.cookie, order, amount); rec.Code != http.StatusBadRequest {
			t.Errorf("%q from a caller with no limit: %d %s, want 400", amount, rec.Code, rec.Body.String())
		}
	}
}
