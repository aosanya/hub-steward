package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"reflect"
	"slices"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/agencies"
)

type businessRegisterWalk struct {
	groupOrderRegisterWalk
	alpha, beta             string
	alphaCookie, betaCookie *http.Cookie
}

func businessRegister(t *testing.T) businessRegisterWalk {
	t.Helper()
	w := referral(t)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	mods, err := mgr.ListModules(ctx, w.draftID, mwanachamaagency.ModuleFilter{})
	if err != nil {
		t.Fatalf("ListModules: %v", err)
	}
	for _, mod := range mods {
		if mod.Code == marketModule {
			if _, err := mgr.SetModuleEnabled(ctx, w.draftID, mod.ID, true); err != nil {
				t.Fatalf("enable market: %v", err)
			}
		}
	}
	workflow, err := mgr.CreateWorkflow(ctx, agencymodels.Workflow{DraftID: w.draftID, Name: "Group order"})
	if err != nil {
		t.Fatalf("CreateWorkflow: %v", err)
	}
	goal, err := mgr.CreateGoal(ctx, agencymodels.Goal{DraftID: w.draftID, Title: "Every business is listed"})
	if err != nil {
		t.Fatalf("CreateGoal: %v", err)
	}
	objective, err := mgr.CreateObjective(ctx, agencymodels.Objective{DraftID: w.draftID, GoalID: goal.ID, Title: "Know each owner"})
	if err != nil {
		t.Fatalf("CreateObjective: %v", err)
	}
	if _, err := mgr.CreateWorkflowObjective(ctx, agencymodels.WorkflowObjective{DraftID: w.draftID, WorkflowID: workflow.ID, ObjectiveID: objective.ID}); err != nil {
		t.Fatalf("CreateWorkflowObjective: %v", err)
	}
	if _, err := mgr.CreateWorkItem(ctx, agencymodels.WorkItem{DraftID: w.draftID, WorkflowID: workflow.ID, Title: "Tell the group", Ordinality: 1, Kind: agencymodels.StepKindNotify, FormName: "Notice", Questions: []agencymodels.StepQuestion{{Prompt: "Message", AnswerType: agencymodels.AnswerFreeText}}}); err != nil {
		t.Fatalf("CreateWorkItem: %v", err)
	}
	businesses, err := mgr.CreateRecord(ctx, agencymodels.Record{
		DraftID: w.draftID, WorkflowID: workflow.ID, Name: "Businesses", RoleID: w.roles["Coordinator"], FormName: "Business",
		Questions: []agencymodels.StepQuestion{
			{Prompt: "Business", AnswerType: agencymodels.AnswerFreeText, Required: true},
			{Prompt: "Owner", AnswerType: agencymodels.AnswerSingleChoice, OptionsFrom: "members", Required: true},
			{Prompt: "Contact", AnswerType: agencymodels.AnswerFreeText},
			{Prompt: "Asset", AnswerType: agencymodels.AnswerSingleChoice, OptionsFrom: "assets"},
		},
	})
	if err != nil {
		t.Fatalf("CreateRecord businesses: %v", err)
	}
	w.publish(t)
	agencyMountedSets.forget(w.instance)

	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	enrol := func(name string) string {
		a, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
		if err != nil {
			t.Fatalf("CreateActor %s: %v", name, err)
		}
		if err := w.deps.Registry.AddMember(ctx, w.instance, a.ID, agencies.RoleResident); err != nil {
			t.Fatalf("AddMember %s: %v", name, err)
		}
		return a.ID
	}
	alpha, beta := enrol("Owner Alpha"), enrol("Owner Beta")
	return businessRegisterWalk{
		groupOrderRegisterWalk: groupOrderRegisterWalk{stepRunWalk: w, register: businesses.Code},
		alpha:                  alpha, beta: beta,
		alphaCookie: w.cookieFor(t, alpha), betaCookie: w.cookieFor(t, beta),
	}
}

func (b businessRegisterWalk) addBusiness(t *testing.T, business, owner, contact, orderID, replaces string) string {
	t.Helper()
	body := map[string]any{"answers": map[string]string{"Business": business, "Owner": owner, "Contact": contact}}
	if orderID != "" {
		body["order_id"] = orderID
	}
	if replaces != "" {
		body["replaces"] = replaces
	}
	rec := b.call(t, "POST", "/instances/"+b.instance+"/live-records/"+b.register+"/rows", body, b.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("adding the row for %s: %d %s", business, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return id
}

func businessesNamed(rows []agencymodels.RecordRow) []string {
	names := []string{}
	for _, row := range rows {
		names = append(names, row.Answers["Business"])
	}
	slices.Sort(names)
	return names
}

func (b businessRegisterWalk) businessesOverHTTP(t *testing.T, as *http.Cookie, query url.Values) []string {
	t.Helper()
	path := "/instances/" + b.instance + "/live-records/" + b.register + "/rows"
	if len(query) > 0 {
		path += "?" + query.Encode()
	}
	rec := b.call(t, "GET", path, nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET %s: %d %s, want 200", path, rec.Code, rec.Body.String())
	}
	var rows []agencymodels.RecordRow
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	return businessesNamed(rows)
}

func (b businessRegisterWalk) businessesOverTool(t *testing.T, subject string, filter map[string]any) []string {
	t.Helper()
	args := map[string]any{"instance_id": b.instance, "record_code": b.register}
	for key, value := range filter {
		args[key] = value
	}
	out := designAgentWalk{stepRunWalk: b.stepRunWalk}.mcpCall(t, subject, listLiveRecordRowsTool, args)
	if out.IsError {
		t.Fatalf("%s with %v: %s, want a list", listLiveRecordRowsTool, filter, toolErrorText(out))
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	var body struct {
		Items []agencymodels.RecordRow `json:"items"`
	}
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatalf("structured content %s does not carry items: %v", encoded, err)
	}
	return businessesNamed(body.Items)
}

func expectBusinesses(t *testing.T, what string, got []string, want ...string) {
	t.Helper()
	if want == nil {
		want = []string{}
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("%s: got %v, want %v", what, got, want)
	}
}

func TestLiveRecordRowsActorFilter_TwoBusinessesWithDifferentOwnersGiveEachOwnerOnlyTheirOwnOverHTTP(t *testing.T) {
	b := businessRegister(t)
	b.addBusiness(t, "Alpha Bakery", b.alpha, "front desk", "", "")
	b.addBusiness(t, "Beta Garage", b.beta, "front desk", "", "")

	expectBusinesses(t, "no answer_actor_id keeps every row", b.businessesOverHTTP(t, b.owner, nil), "Alpha Bakery", "Beta Garage")
	expectBusinesses(t, "answer_actor_id of the first owner", b.businessesOverHTTP(t, b.owner, url.Values{"answer_actor_id": {b.alpha}}), "Alpha Bakery")
	expectBusinesses(t, "answer_actor_id of the second owner", b.businessesOverHTTP(t, b.owner, url.Values{"answer_actor_id": {b.beta}}), "Beta Garage")
}

func TestLiveRecordRowsActorFilter_TwoBusinessesWithDifferentOwnersGiveEachOwnerOnlyTheirOwnOverTheTool(t *testing.T) {
	b := businessRegister(t)
	b.addBusiness(t, "Alpha Bakery", b.alpha, "front desk", "", "")
	b.addBusiness(t, "Beta Garage", b.beta, "front desk", "", "")

	expectBusinesses(t, "no answer_actor_id keeps every row", b.businessesOverTool(t, "test-owner", nil), "Alpha Bakery", "Beta Garage")
	expectBusinesses(t, "answer_actor_id of the first owner", b.businessesOverTool(t, "test-owner", map[string]any{"answer_actor_id": b.alpha}), "Alpha Bakery")
	expectBusinesses(t, "answer_actor_id of the second owner", b.businessesOverTool(t, "test-owner", map[string]any{"answer_actor_id": b.beta}), "Beta Garage")
}

func TestLiveRecordRowsActorFilter_AFreeTextAnswerEqualToTheActorIdIsNotAMatch(t *testing.T) {
	b := businessRegister(t)
	b.addBusiness(t, "Beta Garage", b.beta, "front desk", "", "")
	b.addBusiness(t, "Alpha Bakery", b.alpha, b.beta, "", "")

	over := url.Values{"answer_actor_id": {b.beta}}
	expectBusinesses(t, "over HTTP the row whose Contact text is the id", b.businessesOverHTTP(t, b.owner, over), "Beta Garage")
	expectBusinesses(t, "over the tool the row whose Contact text is the id", b.businessesOverTool(t, "test-owner", map[string]any{"answer_actor_id": b.beta}), "Beta Garage")
}

func TestLiveRecordRowsActorFilter_AnUnknownActorIdGivesAnEmptyListNotAnError(t *testing.T) {
	b := businessRegister(t)
	b.addBusiness(t, "Alpha Bakery", b.alpha, "front desk", "", "")
	b.addBusiness(t, "Beta Garage", b.beta, "front desk", "", "")
	const stranger = "C-nobody-0001"

	expectBusinesses(t, "unknown id over HTTP", b.businessesOverHTTP(t, b.owner, url.Values{"answer_actor_id": {stranger}}))
	expectBusinesses(t, "unknown id over the tool", b.businessesOverTool(t, "test-owner", map[string]any{"answer_actor_id": stranger}))
}

func TestLiveRecordRowsActorFilter_AnEmptyFilterChangesNothing(t *testing.T) {
	b := businessRegister(t)
	b.addBusiness(t, "Alpha Bakery", b.alpha, "front desk", "", "")
	b.addBusiness(t, "Beta Garage", b.beta, "front desk", "", "")

	expectBusinesses(t, "empty query value over HTTP", b.businessesOverHTTP(t, b.owner, url.Values{"answer_actor_id": {""}}), "Alpha Bakery", "Beta Garage")
	expectBusinesses(t, "empty argument over the tool", b.businessesOverTool(t, "test-owner", map[string]any{"answer_actor_id": ""}), "Alpha Bakery", "Beta Garage")
}

func TestLiveRecordRowsActorFilter_ComposesWithTheGroupOrderAndWithHistory(t *testing.T) {
	b := businessRegister(t)
	order := b.startGroupOrder(t)
	garage := b.addBusiness(t, "Beta Garage", b.beta, "front desk", "", "")
	b.addBusiness(t, "Beta Garage Ltd", b.beta, "front desk", "", garage)
	b.addBusiness(t, "Beta Tailor", b.beta, "front desk", order, "")
	b.addBusiness(t, "Alpha Bakery", b.alpha, "front desk", order, "")

	both := func(filter map[string]any, query url.Values, want ...string) {
		t.Helper()
		expectBusinesses(t, "over HTTP with "+query.Encode(), b.businessesOverHTTP(t, b.owner, query), want...)
		expectBusinesses(t, "over the tool with "+query.Encode(), b.businessesOverTool(t, "test-owner", filter), want...)
	}
	both(map[string]any{"answer_actor_id": b.beta}, url.Values{"answer_actor_id": {b.beta}}, "Beta Garage Ltd", "Beta Tailor")
	both(map[string]any{"answer_actor_id": b.beta, "order_id": order}, url.Values{"answer_actor_id": {b.beta}, "order_id": {order}}, "Beta Tailor")
	both(map[string]any{"answer_actor_id": b.alpha, "order_id": order}, url.Values{"answer_actor_id": {b.alpha}, "order_id": {order}}, "Alpha Bakery")
	both(map[string]any{"answer_actor_id": b.beta, "history": true}, url.Values{"answer_actor_id": {b.beta}, "history": {"true"}}, "Beta Garage")
	both(map[string]any{"answer_actor_id": b.alpha, "history": true}, url.Values{"answer_actor_id": {b.alpha}, "history": {"true"}})
}

func TestLiveRecordRowsActorFilter_ACallerWhoDoesNotAddRowsStillSeesOnlyRowsNamingThemSoAnotherActorGivesNothing(t *testing.T) {
	b := businessRegister(t)
	b.addBusiness(t, "Alpha Bakery", b.alpha, "front desk", "", "")
	b.addBusiness(t, "Beta Garage", b.beta, "front desk", "", "")

	expectBusinesses(t, "the first owner reads without a filter", b.businessesOverHTTP(t, b.alphaCookie, nil), "Alpha Bakery")
	expectBusinesses(t, "the first owner filters for herself over HTTP", b.businessesOverHTTP(t, b.alphaCookie, url.Values{"answer_actor_id": {b.alpha}}), "Alpha Bakery")
	expectBusinesses(t, "the first owner filters for the other owner over HTTP", b.businessesOverHTTP(t, b.alphaCookie, url.Values{"answer_actor_id": {b.beta}}))
	expectBusinesses(t, "the first owner filters for herself over the tool", b.businessesOverTool(t, b.alpha, map[string]any{"answer_actor_id": b.alpha}), "Alpha Bakery")
	expectBusinesses(t, "the first owner filters for the other owner over the tool", b.businessesOverTool(t, b.alpha, map[string]any{"answer_actor_id": b.beta}))
}
