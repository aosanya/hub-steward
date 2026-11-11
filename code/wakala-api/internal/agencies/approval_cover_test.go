package agencies

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	agencymodels "wakalaserver/modules/agency/models"
)

var approvalCoverDatabases atomic.Int64

func approvalRegistry(t *testing.T, opts ...Option) *registry {
	t.Helper()
	dsn := fmt.Sprintf("file:wakala_approval_cover_%d?mode=memory&cache=shared", approvalCoverDatabases.Add(1))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	built, err := NewRegistry(db, opts...)
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	return built.(*registry)
}

func TestApprovalOfReadsAnythingUnknownAsApproved(t *testing.T) {
	cases := map[string]string{
		ApprovalPending:  ApprovalPending,
		ApprovalDeclined: ApprovalDeclined,
		ApprovalApproved: ApprovalApproved,
		"":               ApprovalApproved,
		"something-else": ApprovalApproved,
	}
	for stored, want := range cases {
		if got := approvalOf(stored); got != want {
			t.Errorf("approvalOf(%q) = %q, want %q", stored, got, want)
		}
	}
}

func TestNewAgenciesStartPendingUnlessTheRegistryStartsApproved(t *testing.T) {
	ctx := context.Background()
	pending, err := approvalRegistry(t).CreateInstance(ctx, "Needs a look")
	if err != nil {
		t.Fatal(err)
	}
	if pending.Approval != ApprovalPending || pending.Approved() {
		t.Fatalf("default registry gave approval %q", pending.Approval)
	}
	approved, err := approvalRegistry(t, StartingApproved()).CreateInstance(ctx, "Open door")
	if err != nil {
		t.Fatal(err)
	}
	if approved.Approval != ApprovalApproved || !approved.Approved() {
		t.Fatalf("StartingApproved registry gave approval %q", approved.Approval)
	}
}

func TestListPendingInstancesHoldsOnlyUndecidedAgencies(t *testing.T) {
	ctx := context.Background()
	reg := approvalRegistry(t)
	first, _ := reg.CreateInstance(ctx, "First")
	second, _ := reg.CreateInstance(ctx, "Second")
	if _, err := reg.DecideApproval(ctx, first.ID, true, ""); err != nil {
		t.Fatal(err)
	}
	pending, err := reg.ListPendingInstances(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(pending) != 1 || pending[0].ID != second.ID {
		t.Fatalf("pending = %+v, want only %s", pending, second.ID)
	}
}

func TestDecideApprovalRecordsTheDecisionAndTrimmedNote(t *testing.T) {
	ctx := context.Background()
	reg := approvalRegistry(t)
	inst, _ := reg.CreateInstance(ctx, "Declined one")
	got, err := reg.DecideApproval(ctx, inst.ID, false, "  not this time  ")
	if err != nil {
		t.Fatal(err)
	}
	if got.Approval != ApprovalDeclined || got.ApprovalNote != "not this time" {
		t.Fatalf("got approval %q note %q", got.Approval, got.ApprovalNote)
	}
	if pending, _ := reg.ListPendingInstances(ctx); len(pending) != 0 {
		t.Fatalf("a decided agency is still pending: %+v", pending)
	}
}

func TestDecideApprovalRefusesASecondDecision(t *testing.T) {
	ctx := context.Background()
	reg := approvalRegistry(t)
	inst, _ := reg.CreateInstance(ctx, "Once only")
	if _, err := reg.DecideApproval(ctx, inst.ID, true, "yes"); err != nil {
		t.Fatal(err)
	}
	_, err := reg.DecideApproval(ctx, inst.ID, false, "changed my mind")
	if !errors.Is(err, ErrApprovalDecided) {
		t.Fatalf("err = %v, want ErrApprovalDecided", err)
	}
	after, _ := reg.GetInstance(ctx, inst.ID)
	if after.Approval != ApprovalApproved || after.ApprovalNote != "yes" {
		t.Fatalf("a refused second decision changed the row: %+v", after)
	}
}

func TestDecideApprovalRefusesALongNoteBeforeLookingUpTheAgency(t *testing.T) {
	ctx := context.Background()
	reg := approvalRegistry(t)
	_, err := reg.DecideApproval(ctx, "no-such-agency", true, strings.Repeat("é", ApprovalNoteLimit+1))
	if !errors.Is(err, ErrApprovalNoteLong) {
		t.Fatalf("err = %v, want ErrApprovalNoteLong", err)
	}
	inst, _ := reg.CreateInstance(ctx, "Exact limit")
	if _, err := reg.DecideApproval(ctx, inst.ID, true, strings.Repeat("é", ApprovalNoteLimit)); err != nil {
		t.Fatalf("a note of exactly the limit in characters must pass: %v", err)
	}
}

func TestDecideApprovalOnAnUnknownAgencyIsNotADecidedOne(t *testing.T) {
	_, err := approvalRegistry(t).DecideApproval(context.Background(), "ghost", true, "")
	if err == nil || errors.Is(err, ErrApprovalDecided) {
		t.Fatalf("err = %v, want a not-found refusal", err)
	}
}

func timedYesNo(id, workflowID, code string, ordinality int) agencymodels.DocumentWorkItem {
	return agencymodels.DocumentWorkItem{
		ID: id, Code: code, WorkflowID: workflowID, Ordinality: ordinality,
		Kind: agencymodels.StepKindYesNo, TimeLimitMinutes: 30, CancelWorkflowID: "cancel",
	}
}

func TestFirstTimedYesNoStepWalksWorkflowsThenStepsByOrdinality(t *testing.T) {
	doc := agencymodels.AgencyDocument{
		Workflows: []agencymodels.DocumentWorkflow{
			{ID: "w2", Code: "W-2", Ordinality: 2},
			{ID: "w1", Code: "W-1", Ordinality: 1},
		},
		WorkItems: []agencymodels.DocumentWorkItem{
			timedYesNo("s-w1-late", "w1", "WI-LATE", 5),
			timedYesNo("s-w2", "w2", "WI-W2", 1),
			timedYesNo("s-w1-early", "w1", "WI-EARLY", 2),
		},
	}
	step, found := firstTimedYesNoStep(doc)
	if !found || step.workflowCode != "W-1" || step.stepCode != "WI-EARLY" {
		t.Fatalf("got %+v found=%v", step, found)
	}
}

func TestFirstTimedYesNoStepSkipsStepsThatAreNotTimedYesNoWithACancelRoute(t *testing.T) {
	notTimed := timedYesNo("a", "w1", "NO-LIMIT", 1)
	notTimed.TimeLimitMinutes = 0
	noCancel := timedYesNo("b", "w1", "NO-CANCEL", 2)
	noCancel.CancelWorkflowID = ""
	wrongKind := timedYesNo("c", "w1", "NOTIFY", 3)
	wrongKind.Kind = agencymodels.StepKindNotify
	doc := agencymodels.AgencyDocument{
		Workflows: []agencymodels.DocumentWorkflow{{ID: "w1", Code: "W-1"}},
		WorkItems: []agencymodels.DocumentWorkItem{notTimed, noCancel, wrongKind},
	}
	if step, found := firstTimedYesNoStep(doc); found {
		t.Fatalf("nothing qualifies but got %+v", step)
	}
	doc.WorkItems = append(doc.WorkItems, timedYesNo("d", "elsewhere", "ORPHAN", 4))
	if step, found := firstTimedYesNoStep(doc); found {
		t.Fatalf("a step of an unknown workflow must not be picked, got %+v", step)
	}
}

func TestFirstTimedYesNoStepDoesNotReorderTheDocument(t *testing.T) {
	doc := agencymodels.AgencyDocument{
		Workflows: []agencymodels.DocumentWorkflow{{ID: "w2", Ordinality: 2}, {ID: "w1", Ordinality: 1}},
		WorkItems: []agencymodels.DocumentWorkItem{timedYesNo("x", "w1", "B", 9), timedYesNo("y", "w1", "A", 1)},
	}
	firstTimedYesNoStep(doc)
	if doc.Workflows[0].ID != "w2" || doc.WorkItems[0].ID != "x" {
		t.Fatalf("the caller's document was reordered: %+v", doc)
	}
}

func TestAskRunNameIsPrefixedByTheAskID(t *testing.T) {
	if got := askRunName("a1"); got != "ask-a1" {
		t.Fatalf("got %q", got)
	}
}
