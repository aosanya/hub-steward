package http

import (
	"strings"
	"testing"

	"github.com/aosanya/mwanachama-backend-agency/models"
)

type stepAndRoles struct {
	step  models.WorkItem
	lead  models.Role
	other models.Role
}

func (w applyWorld) stepWithTwoRoles(t *testing.T) stepAndRoles {
	t.Helper()
	m := w.agency(t)
	draft := openDraftID(t, w)
	workflow, err := m.CreateWorkflow(w.ctx, models.Workflow{DraftID: draft, Name: "Register a birth"})
	if err != nil {
		t.Fatalf("CreateWorkflow: %v", err)
	}
	step, err := m.CreateWorkItem(w.ctx, models.WorkItem{DraftID: draft, WorkflowID: workflow.ID, Title: "Check the papers", Ordinality: 1})
	if err != nil {
		t.Fatalf("CreateWorkItem: %v", err)
	}
	lead, err := m.CreateRole(w.ctx, models.Role{DraftID: draft, Name: "Lead"})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	other, err := m.CreateRole(w.ctx, models.Role{DraftID: draft, Name: "Clerk"})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	return stepAndRoles{step: step, lead: lead, other: other}
}

func (w applyWorld) accountableRoleOf(t *testing.T, stepID string) string {
	t.Helper()
	step, err := w.agency(t).GetWorkItem(w.ctx, stepID)
	if err != nil {
		t.Fatalf("GetWorkItem: %v", err)
	}
	return step.AccountableRoleID
}

func TestAnApprovedUpdateOfAStepSetsItsAccountableRole(t *testing.T) {
	w := newApplyWorld(t)
	fixture := w.stepWithTwoRoles(t)

	if err := w.apply("agency_update_work_item", map[string]any{"work_item_id": fixture.step.ID, "accountable_role_id": fixture.lead.ID}); err != nil {
		t.Fatalf("approved update: %v", err)
	}
	if got := w.accountableRoleOf(t, fixture.step.ID); got != fixture.lead.ID {
		t.Fatalf("the step's accountable role is %q, want the lead %q", got, fixture.lead.ID)
	}
	step, _ := w.agency(t).GetWorkItem(w.ctx, fixture.step.ID)
	if step.Title != "Check the papers" {
		t.Errorf("the update changed the step's title to %q", step.Title)
	}
}

func TestAnApprovedUpdateWithNoRoleTakesTheAccountableRoleOff(t *testing.T) {
	w := newApplyWorld(t)
	fixture := w.stepWithTwoRoles(t)
	if err := w.apply("agency_update_work_item", map[string]any{"work_item_id": fixture.step.ID, "accountable_role_id": fixture.lead.ID}); err != nil {
		t.Fatalf("set: %v", err)
	}

	if err := w.apply("agency_update_work_item", map[string]any{"work_item_id": fixture.step.ID, "accountable_role_id": ""}); err != nil {
		t.Fatalf("clear: %v", err)
	}
	if got := w.accountableRoleOf(t, fixture.step.ID); got != "" {
		t.Fatalf("the step's accountable role is %q, want none", got)
	}
}

func TestAnApprovedUpdateRefusesARoleOrAStepOutsideTheOpenDraft(t *testing.T) {
	w := newApplyWorld(t)
	fixture := w.stepWithTwoRoles(t)

	if err := w.apply("agency_update_work_item", map[string]any{"work_item_id": fixture.step.ID, "accountable_role_id": "no-such-role"}); err == nil {
		t.Errorf("a role that does not exist was accepted")
	}
	if err := w.apply("agency_update_work_item", map[string]any{"work_item_id": "no-such-step", "accountable_role_id": fixture.lead.ID}); err == nil {
		t.Errorf("a step that does not exist was accepted")
	}
	if err := w.apply("agency_update_work_item", map[string]any{"accountable_role_id": fixture.lead.ID}); err == nil || !strings.Contains(err.Error(), "work_item_id") {
		t.Errorf("an update that names no step gave %v, want a message naming work_item_id", err)
	}
	if got := w.accountableRoleOf(t, fixture.step.ID); got != "" {
		t.Errorf("a refused update left the accountable role %q", got)
	}
}
