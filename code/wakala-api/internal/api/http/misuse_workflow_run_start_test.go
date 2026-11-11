package http

import (
	"context"
	"net/http"
	"slices"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
)

const startRunAction = "taskmanager.workflow_run.start"

func (w stepRunWalk) everyRoleMayStartRuns(t *testing.T) {
	t.Helper()
	w.deps.rolePermissionsOverride = func(context.Context, string) ([]string, error) {
		return []string{taskReadPermission}, nil
	}
	allowed := permissionsAllow
	permissionsAllow = func(codes []string, action string) bool {
		if action == startRunAction {
			return slices.Contains(codes, taskReadPermission)
		}
		return allowed(codes, action)
	}
	t.Cleanup(func() { permissionsAllow = allowed })
}

func TestRunEngine_StartIsRefusedToSomeoneWhoDoesNotHoldTheFirstStepsRole(t *testing.T) {
	w := runEngineWalk(t)
	published := publishedReferralOf(t, w)
	w.everyRoleMayStartRuns(t)

	if code, _ := w.startRun(t, w.people["Liaison"], published.workflow, published.version); code != http.StatusForbidden {
		t.Fatalf("a Liaison starts a run whose first step names the Volunteer: %d, want 403", code)
	}
	if code, _ := w.startRun(t, w.people["Volunteer"], published.workflow, published.version); code != http.StatusCreated {
		t.Fatalf("a Volunteer starts a run whose first step names the Volunteer: %d, want 201", code)
	}
	if code, _ := w.startRun(t, w.owner, published.workflow, published.version); code != http.StatusCreated {
		t.Fatalf("the owner, who holds no role, starts the same run: %d, want 201", code)
	}
}

func TestRunEngine_StartKeepsWorkingWhenTheFirstStepNamesNoRoleToHold(t *testing.T) {
	plan := []stepSpec{
		{title: "Send the sheet", form: "Sheet", role: "Volunteer", kind: agencymodels.StepKindSendForm, questions: []agencymodels.StepQuestion{
			{Prompt: "Reason", AnswerType: agencymodels.AnswerFreeText, Required: true},
		}},
		{title: "Fill the sheet", form: "Filled", role: "Liaison", questions: []agencymodels.StepQuestion{
			{Prompt: "Arrived", AnswerType: agencymodels.AnswerYesNo, Required: true},
		}},
	}
	w := runEngineWalkOf(t, newStepRunWalk(t, plan, "Volunteer", "Liaison"))
	published := publishedReferralOf(t, w, 2)
	w.everyRoleMayStartRuns(t)

	for name, as := range map[string]*http.Cookie{"Liaison": w.people["Liaison"], "Volunteer": w.people["Volunteer"], "owner": w.owner} {
		if code, _ := w.startRun(t, as, published.workflow, published.version); code != http.StatusCreated {
			t.Fatalf("%s starts a run whose first step is a send_form step: %d, want 201", name, code)
		}
	}
}
