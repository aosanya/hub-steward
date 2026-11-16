package models

import (
	"encoding/json"
	"testing"
)

func TestDraftStatus_OnlyAnOpenDraftCanBeArchived(t *testing.T) {
	cases := []struct {
		from, to DraftStatus
		want     bool
	}{
		{DraftStatusOpen, DraftStatusArchived, true},
		{DraftStatusOpen, DraftStatusOpen, false},
		{DraftStatusArchived, DraftStatusOpen, false},
		{DraftStatusArchived, DraftStatusArchived, false},
		{DraftStatusOpen, "promoted", false},
		{"", DraftStatusArchived, false},
	}
	for _, c := range cases {
		if got := c.from.CanTransitionTo(c.to); got != c.want {
			t.Errorf("%q -> %q = %v, want %v", c.from, c.to, got, c.want)
		}
	}
}

func TestIssueSeverity_Valid(t *testing.T) {
	for _, s := range []IssueSeverity{IssueSeverityInfo, IssueSeverityWarning, IssueSeverityError} {
		if !s.Valid() {
			t.Errorf("%s must be valid", s)
		}
	}
	for _, s := range []IssueSeverity{"", "critical", "Error"} {
		if s.Valid() {
			t.Errorf("%q must be refused", s)
		}
	}
}

func TestTargetType_ValidAndValidForControl(t *testing.T) {
	plain := []TargetType{TargetTypeRole, TargetTypeGoal, TargetTypeObjective, TargetTypeWorkflow, TargetTypeWorkItem}
	for _, tt := range plain {
		if !tt.Valid() || !tt.ValidForControl() {
			t.Errorf("%s must be valid for both", tt)
		}
	}
	for _, tt := range []TargetType{TargetTypeRiskPathway, TargetTypeThreat, TargetTypeConsequence} {
		if tt.Valid() {
			t.Errorf("%s must not be a plain attachment target", tt)
		}
		if !tt.ValidForControl() {
			t.Errorf("%s must be a control target", tt)
		}
	}
	for _, tt := range []TargetType{"", "agency", "Role"} {
		if tt.Valid() || tt.ValidForControl() {
			t.Errorf("%q must be refused", tt)
		}
	}
}

func TestControlVocabularies(t *testing.T) {
	for _, b := range []ControlOnBreach{OnBreachBlock, OnBreachHoldForApproval, OnBreachFlag, OnBreachRunWorkflow} {
		if !b.Valid() {
			t.Errorf("on breach %s", b)
		}
	}
	if ControlOnBreach("").Valid() || ControlOnBreach("ignore").Valid() {
		t.Error("unknown on-breach must be refused")
	}
	for _, s := range []ControlSeverity{SeverityLow, SeverityMedium, SeverityHigh} {
		if !s.Valid() {
			t.Errorf("severity %s", s)
		}
	}
	if ControlSeverity("").Valid() || ControlSeverity("critical").Valid() {
		t.Error("unknown severity must be refused")
	}
	for _, o := range []ControlOperator{OperatorEq, OperatorNe, OperatorGt, OperatorGte, OperatorLt, OperatorLte} {
		if !o.Valid() {
			t.Errorf("operator %s", o)
		}
	}
	if ControlOperator("").Valid() || ControlOperator("==").Valid() {
		t.Error("unknown operator must be refused")
	}
}

func TestControl_EnforcedOnlyWhenItNamesAnAction(t *testing.T) {
	if (Control{Text: "advice"}).Enforced() {
		t.Error("a control with no action is advisory")
	}
	if !(Control{Action: "forms.answer.submit"}).Enforced() {
		t.Error("a control with an action is enforced")
	}
}

func TestRACILabel_Valid(t *testing.T) {
	for _, l := range []RACILabel{RACILabelResponsible, RACILabelAccountable, RACILabelConsulted, RACILabelInformed} {
		if !l.Valid() {
			t.Errorf("%s must be valid", l)
		}
	}
	for _, l := range []RACILabel{"", "owner", "Responsible"} {
		if l.Valid() {
			t.Errorf("%q must be refused", l)
		}
	}
}

func TestRiskSide_Valid(t *testing.T) {
	if !RiskSideThreat.Valid() || !RiskSideConsequence.Valid() {
		t.Error("threat and consequence are valid")
	}
	if RiskSide("").Valid() || RiskSide("cause").Valid() {
		t.Error("unknown sides must be refused")
	}
}

func TestOpensIn_ValidAndNormalized(t *testing.T) {
	for _, o := range []OpensIn{"", OpensInForm, OpensInChat} {
		if !o.Valid() {
			t.Errorf("%q must be valid", o)
		}
	}
	if OpensIn("voice").Valid() {
		t.Error("unknown opens-in must be refused")
	}
	if OpensInForm.Normalized() != "" {
		t.Error("form is stored as empty")
	}
	if OpensInChat.Normalized() != OpensInChat || OpensIn("").Normalized() != "" {
		t.Error("chat and empty are unchanged")
	}
}

func TestWorkflow_IsChatOnlyWhenItOpensInChat(t *testing.T) {
	if !(Workflow{OpensIn: OpensInChat}).IsChat() {
		t.Error("chat workflow")
	}
	if (Workflow{OpensIn: OpensInForm}).IsChat() || (Workflow{}).IsChat() {
		t.Error("form and default workflows are not chat")
	}
}

func TestScenarioResult_ValidAndLabel(t *testing.T) {
	labels := map[ScenarioResult]string{
		ScenarioNotRun: "Not run yet", ScenarioWaiting: "Waiting", ScenarioRunning: "Running",
		ScenarioPassed: "Passed", ScenarioFailed: "Failed", ScenarioStopped: "Stopped",
	}
	for r, want := range labels {
		if !r.Valid() || r.Label() != want {
			t.Errorf("%s: valid=%v label=%q", r, r.Valid(), r.Label())
		}
	}
	if ScenarioResult("").Valid() || ScenarioResult("skipped").Valid() {
		t.Error("unknown results must be refused")
	}
	if ScenarioResult("skipped").Label() != "" {
		t.Error("an unknown result has no label")
	}
}

func TestTestRunResult_ValidFinishedAndScenarioResult(t *testing.T) {
	finished := map[TestRunResult]bool{TestRunPassed: true, TestRunFailed: true, TestRunStopped: true}
	for _, r := range []TestRunResult{TestRunWaiting, TestRunRunning, TestRunPassed, TestRunFailed, TestRunStopped} {
		if !r.Valid() {
			t.Errorf("%s must be valid", r)
		}
		if r.Finished() != finished[r] {
			t.Errorf("%s Finished = %v", r, r.Finished())
		}
		if !r.ScenarioResult().Valid() {
			t.Errorf("%s has no matching scenario result", r)
		}
	}
	if TestRunResult("").Valid() || TestRunResult("not_run").Valid() {
		t.Error("not_run is a scenario result, never a run result")
	}
}

func TestNowRFC3339_IsUTCAndSortsByTime(t *testing.T) {
	first := NowRFC3339()
	second := NowRFC3339()
	if first == "" || first[len(first)-1] != 'Z' {
		t.Errorf("not UTC: %q", first)
	}
	if second < first {
		t.Errorf("stamps went backwards: %q then %q", first, second)
	}
}

func TestRole_UnmarshalRemembersWhichKeysTheRequestCarried(t *testing.T) {
	var r Role
	if err := json.Unmarshal([]byte(`{"name":"Clerk","staff":false}`), &r); err != nil {
		t.Fatal(err)
	}
	if !r.FromRequest() {
		t.Error("a decoded role came from a request")
	}
	if !r.Carries("name") || !r.Carries("staff") {
		t.Error("name and staff were sent")
	}
	if r.Carries("description") || r.Carries("permissions") {
		t.Error("description and permissions were not sent")
	}
	if r.Name != "Clerk" {
		t.Errorf("name = %q", r.Name)
	}
}

func TestRole_ABuiltRoleCarriesEveryField(t *testing.T) {
	r := Role{Name: "Clerk"}
	if r.FromRequest() {
		t.Error("a hand-built role is not from a request")
	}
	if !r.Carries("anything") {
		t.Error("a hand-built role carries every field")
	}
}

func TestRole_UnmarshalRefusesNonObjects(t *testing.T) {
	var r Role
	for _, raw := range []string{`[]`, `"x"`, `{"name":5}`, `{`} {
		if err := json.Unmarshal([]byte(raw), &r); err == nil {
			t.Errorf("%s: expected an error", raw)
		}
	}
}
