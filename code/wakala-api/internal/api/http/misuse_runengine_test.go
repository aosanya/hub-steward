package http

import "testing"

func TestRunEngine_MayorAgentCannotStartOrClosePastLimitRuns(t *testing.T) {
	mayor := []string{"report.publish"}
	for _, action := range []string{
		"taskmanager.workflow_run.start",
		"taskmanager.workflow_run.close_past_limit",
		"taskmanager.workflow_run.cancel",
		"taskmanager.workflow_run.begin_step",
	} {
		if permissionsAllow(mayor, action) {
			t.Fatalf("an agent holding report.publish may %s", action)
		}
		if everySeatedAgentMay(action) {
			t.Fatalf("every seated agent may %s", action)
		}
	}
	if !permissionsAllow(mayor, "forms.results.publish") {
		t.Fatalf("an agent holding report.publish may not publish form results")
	}
}
