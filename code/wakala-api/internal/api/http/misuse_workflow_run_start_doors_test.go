package http

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	mwanachamamarket "wakalaserver/modules/market"

	"wakalaserver/internal/agencies"
)

const startRunTool = "taskmanager_workflow_run_start"

func (w stepRunWalk) subjectOf(t *testing.T, as *http.Cookie) string {
	t.Helper()
	s, err := w.deps.Sessions.Verify(context.Background(), as.Value)
	if err != nil {
		t.Fatalf("verify session: %v", err)
	}
	return s.MemberID
}

func (w stepRunWalk) startRunByTool(t *testing.T, subject, workflow string, version int) *mcp.CallToolResult {
	t.Helper()
	return designAgentWalk{stepRunWalk: w}.mcpCall(t, subject, startRunTool, map[string]any{
		"instance_id": w.instance, "workflow_code": workflow, "workflow_version": version,
	})
}

func TestRunEngineTool_StartIsRefusedToSomeoneWhoDoesNotHoldTheFirstStepsRole(t *testing.T) {
	w := runEngineWalk(t)
	published := publishedReferralOf(t, w)
	w.everyRoleMayStartRuns(t)

	liaison := w.subjectOf(t, w.people["Liaison"])
	out := w.startRunByTool(t, liaison, published.workflow, published.version)
	if !out.IsError || !strings.Contains(toolErrorText(out), "role the caller does not hold") {
		t.Fatalf("a Liaison starts a run whose first step names the Volunteer through the tool: error=%v %q, want the role refusal", out.IsError, toolErrorText(out))
	}
	if out := w.startRunByTool(t, w.subjectOf(t, w.people["Volunteer"]), published.workflow, published.version); out.IsError {
		t.Fatalf("a Volunteer starts the run through the tool: %s", toolErrorText(out))
	}
	if out := w.startRunByTool(t, "test-owner", published.workflow, published.version); out.IsError {
		t.Fatalf("the owner starts the run through the tool: %s", toolErrorText(out))
	}
}

func TestRunEngineTool_StartOfAnUnpublishedWorkflowIsRefusedToTheOwner(t *testing.T) {
	w := runEngineWalk(t)
	published := publishedReferralOf(t, w)

	if out := w.startRunByTool(t, "test-owner", "W-999", published.version); !out.IsError {
		t.Fatalf("the owner starts a run of a workflow that does not exist through the tool: %s", toolErrorText(out))
	}
	if out := w.startRunByTool(t, "test-owner", published.workflow, published.version+41); !out.IsError {
		t.Fatalf("the owner starts a run of a version that is not published through the tool: %s", toolErrorText(out))
	}
}

func TestRunEngine_AskRunnerStartsItsTimedStepForAPickerWhoHoldsNoRole(t *testing.T) {
	w := runEngineWalk(t)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	asking, err := mgr.CreateWorkflow(ctx, agencymodels.Workflow{DraftID: w.draftID, Name: "Ask the picker"})
	if err != nil {
		t.Fatalf("CreateWorkflow: %v", err)
	}
	objectives, err := mgr.ListObjectives(ctx, w.draftID, mwanachamaagency.ObjectiveFilter{})
	if err != nil || len(objectives) == 0 {
		t.Fatalf("ListObjectives: %v %d", err, len(objectives))
	}
	if _, err := mgr.CreateWorkflowObjective(ctx, agencymodels.WorkflowObjective{DraftID: w.draftID, WorkflowID: asking.ID, ObjectiveID: objectives[0].ID}); err != nil {
		t.Fatalf("CreateWorkflowObjective: %v", err)
	}
	timed, err := mgr.CreateWorkItem(ctx, agencymodels.WorkItem{
		DraftID: w.draftID, WorkflowID: asking.ID, Title: "Picker answers", Ordinality: 1,
		Kind: agencymodels.StepKindYesNo, RoleID: w.roles["Coordinator"], TimeLimitMinutes: 5, CancelWorkflowID: w.workflow,
		FormName: "Picker answer", Questions: []agencymodels.StepQuestion{{Prompt: "Can you do it", AnswerType: agencymodels.AnswerYesNo, Required: true}},
	})
	if err != nil {
		t.Fatalf("CreateWorkItem: %v", err)
	}
	w.publish(t)
	picker := w.subjectOf(t, w.people["Liaison"])
	if err := agencies.StartAskRun(ctx, w.deps.Registry, w.instance, mwanachamamarket.Ask{ID: "a1", Picker: picker}); err != nil {
		t.Fatalf("StartAskRun: %v", err)
	}

	board, err := w.deps.Registry.TaskManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("TaskManager: %v", err)
	}
	run, err := board.GetWorkflowRunByName(ctx, "ask-a1")
	if err != nil {
		t.Fatalf("the ask's run was not started: %v", err)
	}
	if run.CurrentStepID != timed.Code {
		t.Fatalf("the ask's run waits at %q, want %q", run.CurrentStepID, timed.Code)
	}
}
