package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	mwanachamamarket "wakalaserver/modules/market"
	"wakalaserver/modules/market/models"
)

type groupOrderRegisterWalk struct {
	stepRunWalk
	register string
	standing string
	groupID  string
}

func groupOrderRegister(t *testing.T) groupOrderRegisterWalk {
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
	groupOrders, err := mgr.CreateWorkflow(ctx, agencymodels.Workflow{DraftID: w.draftID, Name: "Group order"})
	if err != nil {
		t.Fatalf("CreateWorkflow: %v", err)
	}
	goal, err := mgr.CreateGoal(ctx, agencymodels.Goal{DraftID: w.draftID, Title: "Every group order is paid"})
	if err != nil {
		t.Fatalf("CreateGoal: %v", err)
	}
	objective, err := mgr.CreateObjective(ctx, agencymodels.Objective{DraftID: w.draftID, GoalID: goal.ID, Title: "Collect the payments"})
	if err != nil {
		t.Fatalf("CreateObjective: %v", err)
	}
	if _, err := mgr.CreateWorkflowObjective(ctx, agencymodels.WorkflowObjective{DraftID: w.draftID, WorkflowID: groupOrders.ID, ObjectiveID: objective.ID}); err != nil {
		t.Fatalf("CreateWorkflowObjective: %v", err)
	}
	if _, err := mgr.CreateWorkItem(ctx, agencymodels.WorkItem{DraftID: w.draftID, WorkflowID: groupOrders.ID, Title: "Tell the group", Ordinality: 1, Kind: agencymodels.StepKindNotify, FormName: "Notice", Questions: []agencymodels.StepQuestion{{Prompt: "Message", AnswerType: agencymodels.AnswerFreeText}}}); err != nil {
		t.Fatalf("CreateWorkItem: %v", err)
	}
	payments, err := mgr.CreateRecord(ctx, agencymodels.Record{
		DraftID: w.draftID, WorkflowID: groupOrders.ID, Name: "Payments", RoleID: w.roles["Coordinator"], FormName: "Payment",
		Questions: []agencymodels.StepQuestion{{Prompt: "Amount", AnswerType: agencymodels.AnswerNumber, Required: true}},
	})
	if err != nil {
		t.Fatalf("CreateRecord payments: %v", err)
	}
	standing, err := mgr.CreateRecord(ctx, agencymodels.Record{
		DraftID: w.draftID, WorkflowID: groupOrders.ID, Name: "Standing list", RoleID: w.roles["Coordinator"], FormName: "Entry",
		Questions: []agencymodels.StepQuestion{{Prompt: "Name", AnswerType: agencymodels.AnswerFreeText, Required: true}},
	})
	if err != nil {
		t.Fatalf("CreateRecord standing: %v", err)
	}
	w.publish(t)
	agencyMountedSets.forget(w.instance)
	return groupOrderRegisterWalk{stepRunWalk: w, register: payments.Code, standing: standing.Code}
}

func (g groupOrderRegisterWalk) startGroupOrder(t *testing.T) string {
	t.Helper()
	ctx := context.Background()
	market, err := g.deps.Registry.MarketManager(ctx, g.instance, "market")
	if err != nil {
		t.Fatalf("MarketManager: %v", err)
	}
	const coordinator = "test-owner"
	poster, err := market.ApplyPoster(ctx, coordinator, mwanachamamarket.Poster{Name: "Seed shop"})
	if err != nil {
		t.Fatalf("ApplyPoster: %v", err)
	}
	if _, err := market.ApprovePoster(ctx, coordinator, poster.ID); err != nil {
		t.Fatalf("ApprovePoster: %v", err)
	}
	order, err := market.StartGroupOrder(ctx, coordinator, mwanachamamarket.GroupOrder{PosterID: poster.ID, Product: "Maize seed", Price: 100, Minimum: 10, Direction: models.DirectionBuy})
	if err != nil {
		t.Fatalf("StartGroupOrder: %v", err)
	}
	return order.ID
}

func (g groupOrderRegisterWalk) addRow(t *testing.T, code string, answers map[string]string, orderID string) int {
	t.Helper()
	body := map[string]any{"answers": answers}
	if orderID != "" {
		body["order_id"] = orderID
	}
	return g.call(t, "POST", "/instances/"+g.instance+"/live-records/"+code+"/rows", body, g.owner).Code
}

func TestLiveRecordRow_RegisterNoStepKeepsTakesOnlyARealRun(t *testing.T) {
	g := groupOrderRegister(t)
	real := g.startGroupOrder(t)
	paid := map[string]string{"Amount": "500"}

	if got := g.addRow(t, g.register, paid, real); got != http.StatusCreated {
		t.Fatalf("a row for a real group order: %d, want 201", got)
	}
	if got := g.addRow(t, g.register, map[string]string{"Amount": "600"}, ""); got != http.StatusCreated {
		t.Fatalf("a row with no order_id on a register with no run to bind: %d, want 201", got)
	}
	if got := g.addRow(t, g.standing, map[string]string{"Name": "Ada"}, ""); got != http.StatusCreated {
		t.Fatalf("a standing-list row with no order_id: %d, want 201", got)
	}

	if got := g.addRow(t, g.register, map[string]string{"Amount": "700"}, "HI-fake-order-0001"); got < 400 || got >= 500 {
		t.Errorf("a row under a made-up order_id: %d, want a 4xx refusal", got)
	}

	sent := g.submit(t, g.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Needs a clinic check", "Minutes to the clinic": "25"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the volunteer's submit: %d %s", sent.Code, sent.Body.String())
	}
	foreign, _ := decodeObject(t, sent)["order_id"].(string)
	if got := g.addRow(t, g.register, map[string]string{"Amount": "800"}, foreign); got < 400 || got >= 500 {
		t.Errorf("a row under the order_id of a run of another workflow: %d, want a 4xx refusal", got)
	}
}
