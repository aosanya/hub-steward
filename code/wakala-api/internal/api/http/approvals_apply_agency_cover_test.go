package http

import (
	"strings"
	"testing"
	"time"

	"wakalaserver/internal/approvals"
	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
)

func openDraftID(t *testing.T, w applyWorld) string {
	t.Helper()
	m := w.agency(t)
	id, err := workingDraftID(w.ctx, m)
	if err != nil {
		t.Fatalf("workingDraftID: %v", err)
	}
	return id
}

func TestApprovedGoalAndRoleLandInTheOpenDraftAndTheApprovalRecordsTheSteps(t *testing.T) {
	w := newApplyWorld(t)
	done, err := w.approved(t, "agency_create_goal", map[string]any{"title": "Fewer queues", "description": "Cut waiting"})
	if err != nil {
		t.Fatalf("approved goal: %v", err)
	}
	if done.Status != approvals.StatusApproved || !strings.Contains(done.Applied, `Created the goal \"Fewer queues\" in the open draft`) {
		t.Fatalf("the approval must record what was done, got status %q applied %q", done.Status, done.Applied)
	}
	if _, err := w.approved(t, "agency_create_role", map[string]any{"name": "Clerk", "description": "Counter work"}); err != nil {
		t.Fatalf("approved role: %v", err)
	}
	m := w.agency(t)
	draft := openDraftID(t, w)
	goals, err := m.ListGoals(w.ctx, draft, mwanachamaagency.GoalFilter{})
	if err != nil || len(goals) != 1 || goals[0].Title != "Fewer queues" {
		t.Fatalf("the open draft must hold the approved goal, got %v %v", goals, err)
	}
	roles, err := m.ListRoles(w.ctx, draft, mwanachamaagency.RoleFilter{})
	if err != nil || len(roles) != 1 || roles[0].Name != "Clerk" {
		t.Fatalf("the open draft must hold the approved role, got %v %v", roles, err)
	}
}

func TestApprovedRoleCanBeRenamedAndDeletedOnlyByNamingIt(t *testing.T) {
	w := newApplyWorld(t)
	if err := w.apply("agency_create_role", map[string]any{"name": "Clerk"}); err != nil {
		t.Fatalf("create: %v", err)
	}
	m := w.agency(t)
	roles, _ := m.ListRoles(w.ctx, openDraftID(t, w), mwanachamaagency.RoleFilter{})
	id := roles[0].ID

	if err := w.apply("agency_update_role", map[string]any{"name": "Chief clerk"}); err == nil || !strings.Contains(err.Error(), "role_id") {
		t.Fatalf("an update that names no role must say so, got %v", err)
	}
	if err := w.apply("agency_update_role", map[string]any{"role_id": id, "name": "Chief clerk", "description": "Leads the counter"}); err != nil {
		t.Fatalf("update: %v", err)
	}
	got, _ := m.GetRole(w.ctx, id)
	if got.Name != "Chief clerk" || got.Description != "Leads the counter" {
		t.Fatalf("the role must carry the new name and description, got %+v", got)
	}
	if err := w.apply("agency_update_role", map[string]any{"role_id": id, "name": "Head clerk"}); err != nil {
		t.Fatalf("update without description: %v", err)
	}
	got, _ = m.GetRole(w.ctx, id)
	if got.Name != "Head clerk" || got.Description != "Leads the counter" {
		t.Fatalf("an update that leaves the description out must keep it, got %+v", got)
	}
	if err := w.apply("agency_delete_role", map[string]any{"role_id": id}); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := m.GetRole(w.ctx, id); err == nil {
		t.Fatal("the deleted role must be gone")
	}
	if err := w.apply("agency_delete_role", map[string]any{"role_id": ""}); err == nil {
		t.Fatal("a delete that names no role must be refused")
	}
}

func TestApprovedWriteOnARoleOutsideTheOpenDraftIsRefused(t *testing.T) {
	w := newApplyWorld(t)
	m := w.agency(t)
	older, err := m.CreateDraft(w.ctx, "Older draft", "", "")
	if err != nil {
		t.Fatalf("CreateDraft: %v", err)
	}
	stray, err := m.CreateRole(w.ctx, models.Role{DraftID: older.ID, Name: "Stray"})
	if err != nil {
		t.Fatalf("CreateRole: %v", err)
	}
	time.Sleep(1100 * time.Millisecond)
	newer, err := m.CreateDraft(w.ctx, "Newer draft", "", "")
	if err != nil {
		t.Fatalf("CreateDraft: %v", err)
	}
	if working, _ := workingDraftID(w.ctx, m); working != newer.ID {
		t.Fatalf("the newest open draft must be the working one, got %q want %q", working, newer.ID)
	}
	if err := w.apply("agency_delete_role", map[string]any{"role_id": stray.ID}); err == nil || !strings.Contains(err.Error(), "not in the open draft") {
		t.Fatalf("a role in another draft must not be deleted, got %v", err)
	}
	if err := w.apply("agency_update_role", map[string]any{"role_id": stray.ID, "name": "Renamed"}); err == nil || !strings.Contains(err.Error(), "not in the open draft") {
		t.Fatalf("a role in another draft must not be renamed, got %v", err)
	}
}

func TestApprovedGoalWithNoPayloadIsRefusedAndTheApprovalReopens(t *testing.T) {
	w := newApplyWorld(t)
	store, _ := w.reg.Approvals(w.ctx, w.instanceID)
	proposed, err := store.Propose(w.ctx, "proposer", "agency_create_goal", "empty", "")
	if err != nil {
		t.Fatalf("Propose: %v", err)
	}
	decided, err := store.Decide(w.ctx, proposed.ID, "owner", approvals.StatusApproved, "", "")
	if err != nil {
		t.Fatalf("Decide: %v", err)
	}
	_, applyErr := applyApproved(w.ctx, w.reg, applyEnv{}, w.instanceID, store, decided)
	if applyErr == nil || !strings.Contains(applyErr.Error(), "carries no payload") {
		t.Fatalf("a proposal with no payload must fail with that reason, got %v", applyErr)
	}
	again, _ := store.Get(w.ctx, proposed.ID)
	if again.Status != approvals.StatusPending {
		t.Fatalf("a failed write must put the approval back to pending, got %q", again.Status)
	}
}

func TestApprovedKindNobodyAppliesIsLeftAsDecided(t *testing.T) {
	w := newApplyWorld(t)
	done, err := w.approved(t, "not_a_known_kind", map[string]any{})
	if err != nil {
		t.Fatalf("an unknown kind must pass through, got %v", err)
	}
	if done.Status != approvals.StatusApproved || done.Applied != "" {
		t.Fatalf("an unknown kind is approved and not applied, got %+v", done)
	}
}

func TestApprovedAgencyJoinModeAndRenameReachTheInstance(t *testing.T) {
	w := newApplyWorld(t)
	if err := w.apply("instance_rename", map[string]any{"name": "Market hall"}); err != nil {
		t.Fatalf("rename: %v", err)
	}
	if err := w.apply("instance_set_join_mode", map[string]any{"join_mode": "open"}); err != nil {
		t.Fatalf("join mode: %v", err)
	}
	got, err := w.reg.GetInstance(w.ctx, w.instanceID)
	if err != nil || got.Name != "Market hall" || got.JoinMode != "open" {
		t.Fatalf("the instance must carry the approved name and join mode, got %+v %v", got, err)
	}
	if err := w.apply("instance_set_join_mode", map[string]any{"join_mode": "whenever"}); err == nil {
		t.Fatal("an unknown join mode must be refused")
	}
}

func TestApprovedAgencyDetailsAreUpdated(t *testing.T) {
	w := newApplyWorld(t)
	if err := w.apply("agency_update_agency", map[string]any{"name": "Town hall", "description": "Serves the ward"}); err != nil {
		t.Fatalf("update agency: %v", err)
	}
	got, err := w.agency(t).GetAgency(w.ctx)
	if err != nil || got.Description != "Serves the ward" {
		t.Fatalf("the agency must carry the approved description, got %+v %v", got, err)
	}
}
