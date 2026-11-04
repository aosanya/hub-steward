package mwanachamaagency

import (
	"wakalaserver/modules/shared/spec"
)

type TableNames struct {
	Agencies           string
	Drafts             string
	Goals              string
	Objectives         string
	Workflows          string
	WorkItems          string
	EventFlowSteps     string
	AgencyPublications string
	Roles              string
	WorkflowObjectives string
	RoleAssignments    string
	Modules            string
	Values             string
	ValueAttachments   string
	Rules              string
	RuleAttachments    string
	Controls           string
	ControlAttachments string
	Issues             string
	CodeSequences      string
	Records            string
	RecordRows         string
	Measures           string
	Risks              string
	RiskPathways       string
	Scenarios          string
	ScenarioActors     string
	ScenarioInputs     string
	TestRuns           string
	Reviews            string
	ReviewAreas        string
	ReviewFindings     string
	ReviewComments     string
}

func TablesFor(s *spec.Spec) TableNames {
	table := func(role string) string {
		o, ok := s.ByRole(role)
		if !ok {
			return ""
		}
		return s.TableFor(o)
	}
	return TableNames{
		Agencies:           table(roleAgency),
		Drafts:             table(roleDraft),
		Goals:              table(roleGoal),
		Objectives:         table(roleObjective),
		Workflows:          table(roleWorkflow),
		WorkItems:          table(roleWorkItem),
		EventFlowSteps:     table(roleEventFlowStep),
		AgencyPublications: table(rolePublication),
		Roles:              table(roleRole),
		RoleAssignments:    table(roleRoleAssignment),
		WorkflowObjectives: table(roleWorkflowObjective),
		Modules:            table(roleModule),
		Values:             table(roleValue),
		ValueAttachments:   table(roleValueAttachment),
		Rules:              table(roleRule),
		RuleAttachments:    table(roleRuleAttachment),
		Controls:           table(roleControl),
		ControlAttachments: table(roleControlAttachment),
		Issues:             table(roleIssue),
		CodeSequences:      table(roleCodeSequence),
		Records:            table(roleRecord),
		RecordRows:         table(roleRecordRow),
		Measures:           table(roleMeasure),
		Risks:              table(roleRisk),
		RiskPathways:       table(roleRiskPathway),
		Scenarios:          table(roleScenario),
		ScenarioActors:     table(roleScenarioActor),
		ScenarioInputs:     table(roleScenarioInput),
		TestRuns:           table(roleTestRun),
		Reviews:            table(roleReview),
		ReviewAreas:        table(roleReviewArea),
		ReviewFindings:     table(roleReviewFinding),
		ReviewComments:     table(roleReviewComment),
	}
}
