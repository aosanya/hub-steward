package models

import "encoding/json"

type AgencyDocument struct {
	Agency             DocumentAgency              `json:"agency"`
	Roles              []DocumentRole              `json:"roles"`
	Goals              []DocumentGoal              `json:"goals"`
	Objectives         []DocumentObjective         `json:"objectives"`
	Workflows          []DocumentWorkflow          `json:"workflows"`
	WorkflowObjectives []DocumentWorkflowObjective `json:"workflow_objectives"`
	WorkItems          []DocumentWorkItem          `json:"work_items"`
	RoleAssignments    []DocumentRoleAssignment    `json:"role_assignments"`
	Values             []DocumentStatement         `json:"values"`
	Rules              []DocumentStatement         `json:"rules"`
	ValueAttachments   []DocumentAttachment        `json:"value_attachments"`
	RuleAttachments    []DocumentAttachment        `json:"rule_attachments"`
	Modules            []DocumentModule            `json:"modules"`
	EventFlowSteps     []EventFlowStep             `json:"event_flow_steps"`
	Records            []DocumentRecord            `json:"records,omitempty"`
	Measures           []DocumentMeasure           `json:"measures,omitempty"`
	Scenarios          []DocumentScenario          `json:"scenarios,omitempty"`
	Risks              []DocumentRisk              `json:"risks,omitempty"`
	RiskPathways       []DocumentRiskPathway       `json:"risk_pathways,omitempty"`
	Controls           []DocumentControl           `json:"controls,omitempty"`
	ControlAttachments []DocumentControlAttachment `json:"control_attachments,omitempty"`
	Hazards            []DocumentHazard            `json:"hazards,omitempty"`
	Threats            []DocumentThreat            `json:"threats,omitempty"`
	Consequences       []DocumentConsequence       `json:"consequences,omitempty"`
	RiskThreats        []DocumentRiskThreat        `json:"risk_threats,omitempty"`
	RiskConsequences   []DocumentRiskConsequence   `json:"risk_consequences,omitempty"`
}

type DocumentHazard struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
}

type DocumentThreat struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
}

type DocumentConsequence struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Title       string `json:"title"`
	HazardCode  string `json:"hazard_code,omitempty"`
	Description string `json:"description,omitempty"`
}

type DocumentRiskThreat struct {
	RiskCode   string `json:"risk_code"`
	ThreatCode string `json:"threat_code"`
}

type DocumentRiskConsequence struct {
	RiskCode        string `json:"risk_code"`
	ConsequenceCode string `json:"consequence_code"`
}

type DocumentControl struct {
	ID           string          `json:"id"`
	Code         string          `json:"code"`
	Text         string          `json:"text"`
	Action       string          `json:"action,omitempty"`
	CondField    string          `json:"cond_field,omitempty"`
	CondOperator ControlOperator `json:"cond_operator,omitempty"`
	CondValue    string          `json:"cond_value,omitempty"`
	OnBreach     ControlOnBreach `json:"on_breach,omitempty"`
	WorkflowID   string          `json:"workflow_id,omitempty"`
	Severity     ControlSeverity `json:"severity,omitempty"`
}

type DocumentControlAttachment struct {
	ControlCode string `json:"control_code"`
	TargetType  string `json:"target_type"`
	TargetCode  string `json:"target_code"`
}

type DocumentAgency struct {
	Name                         string `json:"name"`
	Description                  string `json:"description"`
	Enabled                      bool   `json:"enabled"`
	DefaultFailurePipelineBudget int    `json:"default_failure_pipeline_budget"`
	InactivityTimeoutSeconds     int    `json:"inactivity_timeout_seconds"`
	EventFlows                   string `json:"event_flows"`
}

type DocumentRole struct {
	ID          string   `json:"id"`
	Code        string   `json:"code"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions,omitempty"`
	Staff       bool     `json:"staff,omitempty"`
}

type DocumentGoal struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Ordinality  int    `json:"ordinality"`
}

type DocumentObjective struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	GoalID      string `json:"goal_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Ordinality  int    `json:"ordinality"`
}

type DocumentWorkflow struct {
	ID          string  `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Ordinality  int     `json:"ordinality"`
	EventFlows  string  `json:"event_flows"`
	OpensIn     OpensIn `json:"opens_in,omitempty"`

	CancelsOrder bool `json:"cancels_order,omitempty"`
}

type DocumentWorkItem struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	WorkflowID  string `json:"workflow_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Ordinality  int    `json:"ordinality"`
	Prompt      string `json:"prompt"`

	LegacyObjectiveID string `json:"objective_id,omitempty"`

	Kind          StepKind       `json:"kind,omitempty"`
	RoleID        string         `json:"role_id,omitempty"`
	RunWorkflowID string         `json:"run_workflow_id,omitempty"`
	FormName      string         `json:"form_name,omitempty"`
	Questions     []StepQuestion `json:"questions,omitempty"`
	Tool          string         `json:"tool,omitempty"`

	RecipientRoleID string      `json:"recipient_role_id,omitempty"`
	SentStepID      string      `json:"sent_step_id,omitempty"`
	Routes          []StepRoute `json:"routes,omitempty"`
	OtherwiseStepID string      `json:"otherwise_step_id,omitempty"`

	TimeLimitMinutes int    `json:"time_limit_minutes,omitempty"`
	CancelWorkflowID string `json:"cancel_workflow_id,omitempty"`

	AgentRoleID      string   `json:"agent_role_id,omitempty"`
	Topic            string   `json:"topic,omitempty"`
	OpeningLine      string   `json:"opening_line,omitempty"`
	Prompts          []string `json:"prompts,omitempty"`
	Tools            []string `json:"tools,omitempty"`
	StartWorkflowIDs []string `json:"start_workflow_ids,omitempty"`
}

type DocumentWorkflowObjective struct {
	ID          string `json:"id"`
	WorkflowID  string `json:"workflow_id"`
	ObjectiveID string `json:"objective_id"`
}

type DocumentRoleAssignment struct {
	ID         string `json:"id,omitempty"`
	WorkItemID string `json:"work_item_id"`
	RoleID     string `json:"role_id"`
	Label      string `json:"label"`

	LegacyObjectiveID string `json:"objective_id,omitempty"`
}

type DocumentStatement struct {
	ID   string `json:"id"`
	Code string `json:"code"`
	Text string `json:"text"`
}
type DocumentAttachment struct {
	ValueID    string `json:"value_id,omitempty"`
	ValueCode  string `json:"value_code,omitempty"`
	RuleID     string `json:"rule_id,omitempty"`
	RuleCode   string `json:"rule_code,omitempty"`
	TargetType string `json:"target_type"`
	TargetCode string `json:"target_code"`
}

type DocumentModule struct {
	ID       string          `json:"id"`
	Code     string          `json:"code"`
	Enabled  bool            `json:"enabled"`
	Spec     json.RawMessage `json:"spec,omitempty"`
	Settings json.RawMessage `json:"settings,omitempty"`
	Mounts   json.RawMessage `json:"mounts,omitempty"`
}
