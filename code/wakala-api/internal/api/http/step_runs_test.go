package http

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

func referralPlan() []stepSpec {
	return []stepSpec{
		{title: "Report a referral", form: "Referral", role: "Volunteer", questions: []agencymodels.StepQuestion{
			{Prompt: "Reason", AnswerType: agencymodels.AnswerFreeText, Required: true},
			{Prompt: "Minutes to the clinic", AnswerType: agencymodels.AnswerNumber, Required: true},
		}},
		{title: "Confirm arrival", form: "Arrival", role: "Liaison", questions: []agencymodels.StepQuestion{
			{Prompt: "Arrived", AnswerType: agencymodels.AnswerYesNo, Required: true},
		}},
		{title: "Close the referral", form: "Closure", role: "Coordinator", questions: []agencymodels.StepQuestion{
			{Prompt: "Note", AnswerType: agencymodels.AnswerFreeText},
		}},
	}
}

func referral(t *testing.T) stepRunWalk {
	t.Helper()
	return newStepRunWalk(t, referralPlan(), "Volunteer", "Liaison", "Coordinator")
}

func titles(items []map[string]any) []string {
	out := []string{}
	for _, item := range items {
		out = append(out, item["title"].(string))
	}
	return out
}

func sameTitles(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}

func TestPublishKeepsOneRegisterPerFormStep(t *testing.T) {
	w := referral(t)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	draftID, err := liveDraftOf(ctx, mgr)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	records, err := mgr.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	if len(records) != 3 {
		t.Fatalf("the published agency keeps %d registers, want 3: %v", len(records), records)
	}
	for _, r := range records {
		step, ok := w.steps[r.Name]
		if !ok || r.WorkflowID != w.workflow || r.RoleID == "" || len(r.Questions) == 0 || step == "" {
			t.Errorf("register %v does not follow its step", r)
		}
	}
}

func TestEnsureStepRecordsIsIdempotentAndFollowsTheStep(t *testing.T) {
	w := referral(t)
	ctx := context.Background()
	mgr, _ := w.deps.Registry.AgencyManager(ctx, w.instance)
	draft, err := mgr.CreateDraft(ctx, "again", "v1", "publication")
	if err != nil {
		t.Fatalf("fork draft: %v", err)
	}
	rp := rolesPublished{AgencyManager: mgr, instanceID: w.instance}
	for i := 0; i < 2; i++ {
		if err := rp.ensureStepRecords(ctx, draft.ID); err != nil {
			t.Fatalf("ensureStepRecords run %d: %v", i+1, err)
		}
	}
	records, err := mgr.ListRecords(ctx, draft.ID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	if len(records) != 3 {
		t.Fatalf("a forked draft keeps %d registers after two syncs, want 3", len(records))
	}
	steps, _ := mgr.ListWorkItems(ctx, draft.ID, mwanachamaagency.WorkItemFilter{})
	for _, s := range steps {
		if s.Title != "Confirm arrival" {
			continue
		}
		s.Questions = append(s.Questions, agencymodels.StepQuestion{Prompt: "Minutes late", AnswerType: agencymodels.AnswerNumber})
		if _, err := mgr.UpdateWorkItem(ctx, s); err != nil {
			t.Fatalf("UpdateWorkItem: %v", err)
		}
	}
	if err := rp.ensureStepRecords(ctx, draft.ID); err != nil {
		t.Fatalf("ensureStepRecords after the change: %v", err)
	}
	records, _ = mgr.ListRecords(ctx, draft.ID, mwanachamaagency.RecordFilter{})
	for _, r := range records {
		if r.Name == "Confirm arrival" && len(r.Questions) != 2 {
			t.Errorf("the register of a changed step has %d questions, want 2", len(r.Questions))
		}
	}
}

func TestEachMemberSeesOnlyTheirOwnFormStep(t *testing.T) {
	w := referral(t)
	if got := titles(w.available(t, w.people["Volunteer"])); !sameTitles(got, []string{"Report a referral"}) {
		t.Errorf("the volunteer sees %v, want only her own step", got)
	}
	for _, role := range []string{"Liaison", "Coordinator"} {
		if got := titles(w.available(t, w.people[role])); len(got) != 0 {
			t.Errorf("the %s sees %v before any run has reached her, want none", role, got)
		}
	}
	first := w.available(t, w.people["Volunteer"])[0]
	if first["state"] != "start" || first["order_id"] != nil || first["record_code"] == "" || first["form_name"] != "Referral" {
		t.Errorf("the volunteer's step = %v", first)
	}
	if qs, _ := first["questions"].([]any); len(qs) != 2 {
		t.Errorf("the step lists %d questions, want 2", len(qs))
	}
}

func TestTheListWithoutAvailableKeepsEveryHeldStep(t *testing.T) {
	w := referral(t)
	rec := w.call(t, "GET", "/instances/"+w.instance+"/my-open-steps", nil, w.people["Volunteer"])
	if rec.Code != http.StatusOK {
		t.Fatalf("my-open-steps: %d %s", rec.Code, rec.Body.String())
	}
	items := decodeObjects(t, rec)
	if got := titles(items); !sameTitles(got, []string{"Report a referral"}) {
		t.Errorf("the plain list shows %v", got)
	}
	if _, has := items[0]["state"]; has {
		t.Errorf("the plain list carries a state: %v", items[0])
	}
}

func TestARunMovesFromRoleToRoleUntilItIsDone(t *testing.T) {
	w := referral(t)

	sent := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Needs a clinic check", "Minutes to the clinic": "25"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the volunteer's submit: %d %s", sent.Code, sent.Body.String())
	}
	out := decodeObject(t, sent)
	order, _ := out["order_id"].(string)
	next, _ := out["next_step"].(map[string]any)
	if order == "" || out["done"] != true || out["row_id"] == "" || out["record_code"] == "" || next["title"] != "Confirm arrival" || next["role_name"] != "Liaison" || next["order_id"] != order {
		t.Fatalf("submit result = %v", out)
	}

	liaison := w.available(t, w.people["Liaison"])
	if len(liaison) != 1 || liaison[0]["title"] != "Confirm arrival" || liaison[0]["state"] != "waiting" || liaison[0]["order_id"] != order {
		t.Fatalf("the liaison now sees %v, want her step waiting on that run", liaison)
	}
	if got := titles(w.available(t, w.people["Coordinator"])); len(got) != 0 {
		t.Errorf("the coordinator sees %v too early", got)
	}
	for _, item := range w.available(t, w.people["Volunteer"]) {
		if item["state"] == "waiting" {
			t.Errorf("the volunteer still sees a waiting step: %v", item)
		}
	}

	arrived := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, order)
	if arrived.Code != http.StatusCreated {
		t.Fatalf("the liaison's submit: %d %s", arrived.Code, arrived.Body.String())
	}
	if after, _ := decodeObject(t, arrived)["next_step"].(map[string]any); after["title"] != "Close the referral" {
		t.Errorf("after the liaison the next step is %v", after)
	}
	if got := titles(w.available(t, w.people["Liaison"])); len(got) != 0 {
		t.Errorf("the liaison still sees %v after sending", got)
	}
	coordinator := w.available(t, w.people["Coordinator"])
	if len(coordinator) != 1 || coordinator[0]["order_id"] != order {
		t.Fatalf("the coordinator sees %v, want the closing step of that run", coordinator)
	}

	closed := w.submit(t, w.people["Coordinator"], "Close the referral", map[string]string{}, order)
	if closed.Code != http.StatusCreated {
		t.Fatalf("the coordinator's submit: %d %s", closed.Code, closed.Body.String())
	}
	if decodeObject(t, closed)["next_step"] != nil {
		t.Errorf("the last step has no next step: %s", closed.Body.String())
	}
	if got := titles(w.available(t, w.people["Coordinator"])); len(got) != 0 {
		t.Errorf("a finished run still waits for the coordinator: %v", got)
	}
}

func TestTwoRunsWaitSeparately(t *testing.T) {
	w := referral(t)
	for _, reason := range []string{"Fever", "Injury"} {
		if rec := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": reason, "Minutes to the clinic": "10"}, ""); rec.Code != http.StatusCreated {
			t.Fatalf("submit %s: %d %s", reason, rec.Code, rec.Body.String())
		}
	}
	waiting := w.available(t, w.people["Liaison"])
	if len(waiting) != 2 || waiting[0]["order_id"] == waiting[1]["order_id"] {
		t.Fatalf("the liaison sees %v, want two waiting runs", waiting)
	}
}

func TestOnlyTheStepsRoleMaySend(t *testing.T) {
	w := referral(t)
	answers := map[string]string{"Reason": "Fever", "Minutes to the clinic": "10"}
	if rec := w.submit(t, w.people["Liaison"], "Report a referral", answers, ""); rec.Code != http.StatusForbidden {
		t.Errorf("a member without the role sending the step: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.submit(t, w.owner, "Report a referral", answers, ""); rec.Code != http.StatusForbidden {
		t.Errorf("the owner without the role sending the step: %d %s, want 403", rec.Code, rec.Body.String())
	}
	sent := decodeObject(t, w.submit(t, w.people["Volunteer"], "Report a referral", answers, ""))
	order, _ := sent["order_id"].(string)
	if rec := w.submit(t, w.people["Volunteer"], "Confirm arrival", map[string]string{"Arrived": "yes"}, order); rec.Code != http.StatusForbidden {
		t.Errorf("the volunteer sending the liaison's step: %d %s, want 403", rec.Code, rec.Body.String())
	}
}

func TestARunOnlyAcceptsTheStepItIsWaitingFor(t *testing.T) {
	w := referral(t)
	sent := decodeObject(t, w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Fever", "Minutes to the clinic": "10"}, ""))
	order, _ := sent["order_id"].(string)

	if rec := w.submit(t, w.people["Coordinator"], "Close the referral", map[string]string{}, order); rec.Code != http.StatusConflict {
		t.Errorf("closing a run that has not reached the coordinator: %d %s, want 409", rec.Code, rec.Body.String())
	}
	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, "no-such-run"); rec.Code != http.StatusConflict {
		t.Errorf("a run that does not exist: %d %s, want 409", rec.Code, rec.Body.String())
	}
	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, ""); rec.Code != http.StatusBadRequest {
		t.Errorf("a later step without its run: %d %s, want 400", rec.Code, rec.Body.String())
	}
	if rec := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Fever", "Minutes to the clinic": "10"}, order); rec.Code != http.StatusBadRequest {
		t.Errorf("a first step with a run: %d %s, want 400", rec.Code, rec.Body.String())
	}
	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, order); rec.Code != http.StatusCreated {
		t.Fatalf("the liaison's step still works after the refusals: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "no"}, order); rec.Code != http.StatusConflict {
		t.Errorf("a step sent twice for one run: %d %s, want 409", rec.Code, rec.Body.String())
	}
}

func TestAnswersAreCheckedAgainstTheStepsQuestions(t *testing.T) {
	w := referral(t)
	cases := []struct {
		name    string
		answers map[string]string
	}{
		{"a required answer missing", map[string]string{"Reason": "Fever"}},
		{"a number that is not one", map[string]string{"Reason": "Fever", "Minutes to the clinic": "soon"}},
		{"an answer to a question the form does not ask", map[string]string{"Reason": "Fever", "Minutes to the clinic": "5", "Colour": "red"}},
	}
	for _, c := range cases {
		if rec := w.submit(t, w.people["Volunteer"], "Report a referral", c.answers, ""); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: %d %s, want 400", c.name, rec.Code, rec.Body.String())
		}
	}
	if got := titles(w.available(t, w.people["Liaison"])); len(got) != 0 {
		t.Errorf("a refused submit moved the run on: the liaison sees %v", got)
	}
	liaison := decodeObject(t, w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Fever", "Minutes to the clinic": "5"}, ""))
	order, _ := liaison["order_id"].(string)
	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "maybe"}, order); rec.Code != http.StatusBadRequest {
		t.Errorf("a yes or no answered maybe: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestAStepThatIsNotAFormStepOfTheLiveAgencyIsNotFound(t *testing.T) {
	w := referral(t)
	rec := w.call(t, "POST", "/instances/"+w.instance+"/steps/no-such-step/answers", map[string]any{"answers": map[string]string{}}, w.people["Volunteer"])
	if rec.Code != http.StatusNotFound {
		t.Errorf("an unknown step: %d %s, want 404", rec.Code, rec.Body.String())
	}
}

func TestPublishingTheFarmersDemoKeepsItsPaymentsRegisterAndAddsOneForEachFormStep(t *testing.T) {
	raw, err := os.ReadFile("../../../../../demo/farmers/agency.json")
	if err != nil {
		t.Fatalf("read the farmers demo: %v", err)
	}
	var doc agencymodels.AgencyDocument
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("decode the farmers demo: %v", err)
	}
	w := newStepRunWalk(t, nil)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	imported, err := mgr.ImportDocument(ctx, "farmers", doc)
	if err != nil {
		t.Fatalf("ImportDocument: %v", err)
	}
	before, err := mgr.ListRecords(ctx, imported.Draft.ID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	steps, err := mgr.ListWorkItems(ctx, imported.Draft.ID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		t.Fatalf("ListWorkItems: %v", err)
	}
	formSteps := 0
	for _, s := range steps {
		if stepKeepsRecord(s) {
			formSteps++
		}
	}
	w.draftID = imported.Draft.ID
	w.publish(t)
	live, err := liveDraftOf(ctx, mgr)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	after, err := mgr.ListRecords(ctx, live, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords after: %v", err)
	}
	if len(after) != len(before)+formSteps {
		t.Errorf("the farmers' agency keeps %d registers after publishing, want %d already there plus %d form steps", len(after), len(before), formSteps)
	}
	for _, r := range before {
		kept := false
		for _, a := range after {
			if a.Code == r.Code && a.Name == r.Name && a.RoleID == r.RoleID {
				kept = true
			}
		}
		if !kept {
			t.Errorf("the existing register %s %q changed", r.Code, r.Name)
		}
	}
}

func TestTheSubmitToolIsNamedAndOpenToSeatedMembers(t *testing.T) {
	if LocalActions()[submitStepAnswersTool] != submitStepAnswersAction {
		t.Errorf("the tool %s does not name its action", submitStepAnswersTool)
	}
	if !everySeatedAgentMay(submitStepAnswersAction) {
		t.Errorf("a seated member may not call %s", submitStepAnswersAction)
	}
}

func TestAStepPublishedWithoutItsRegisterIsRefusedWithAConflict(t *testing.T) {
	w := referral(t)
	ctx := context.Background()
	mgr, _ := w.deps.Registry.AgencyManager(ctx, w.instance)
	draft, err := mgr.CreateDraft(ctx, "a late step", "v1", "publication")
	if err != nil {
		t.Fatalf("fork draft: %v", err)
	}
	workflows, _ := mgr.ListWorkflows(ctx, draft.ID, mwanachamaagency.WorkflowFilter{})
	roles, _ := mgr.ListRoles(ctx, draft.ID, mwanachamaagency.RoleFilter{})
	volunteer := ""
	for _, r := range roles {
		if r.Name == "Volunteer" {
			volunteer = r.ID
		}
	}
	late, err := mgr.CreateWorkItem(ctx, agencymodels.WorkItem{
		DraftID: draft.ID, WorkflowID: workflows[0].ID, Title: "Late step", Ordinality: 4,
		Kind: agencymodels.StepKindFillForm, RoleID: volunteer, FormName: "Late",
		Questions: []agencymodels.StepQuestion{{Prompt: "Why", AnswerType: agencymodels.AnswerFreeText, Required: true}},
	})
	if err != nil {
		t.Fatalf("CreateWorkItem: %v", err)
	}
	if _, err := mgr.PublishAgency(ctx, draft.ID, "", ""); err != nil {
		t.Fatalf("PublishAgency: %v", err)
	}
	rec := w.call(t, "POST", "/instances/"+w.instance+"/steps/"+late.ID+"/answers", map[string]any{"answers": map[string]string{"Why": "Because"}, "order_id": "x"}, w.people["Volunteer"])
	if rec.Code != http.StatusConflict {
		t.Errorf("a step with no register: %d %s, want 409", rec.Code, rec.Body.String())
	}
	for _, item := range w.available(t, w.people["Volunteer"]) {
		if item["title"] == "Late step" {
			t.Errorf("a step with no register is listed as available: %v", item)
		}
	}
}
