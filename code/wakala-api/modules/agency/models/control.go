package models

type ControlOnBreach string

const (
	OnBreachBlock           ControlOnBreach = "block"
	OnBreachHoldForApproval ControlOnBreach = "hold_for_approval"
	OnBreachFlag            ControlOnBreach = "flag"
	OnBreachRunWorkflow     ControlOnBreach = "run_workflow"
)

func (b ControlOnBreach) Valid() bool {
	switch b {
	case OnBreachBlock, OnBreachHoldForApproval, OnBreachFlag, OnBreachRunWorkflow:
		return true
	default:
		return false
	}
}

type ControlSeverity string

const (
	SeverityLow    ControlSeverity = "low"
	SeverityMedium ControlSeverity = "medium"
	SeverityHigh   ControlSeverity = "high"
)

func (s ControlSeverity) Valid() bool {
	switch s {
	case SeverityLow, SeverityMedium, SeverityHigh:
		return true
	default:
		return false
	}
}

type ControlStrength string

const (
	StrengthAdvisory ControlStrength = "advisory"
	StrengthEnforced ControlStrength = "enforced"
	StrengthTested   ControlStrength = "tested"
)

type ControlOperator string

const (
	OperatorEq  ControlOperator = "eq"
	OperatorNe  ControlOperator = "ne"
	OperatorGt  ControlOperator = "gt"
	OperatorGte ControlOperator = "gte"
	OperatorLt  ControlOperator = "lt"
	OperatorLte ControlOperator = "lte"
)

func (o ControlOperator) Valid() bool {
	switch o {
	case OperatorEq, OperatorNe, OperatorGt, OperatorGte, OperatorLt, OperatorLte:
		return true
	default:
		return false
	}
}

type Control struct {
	ID           string          `json:"id"`
	Code         string          `json:"code"`
	DraftID      string          `json:"draft_id"`
	Text         string          `json:"text"`
	Action       string          `json:"action,omitempty"`
	CondField    string          `json:"cond_field,omitempty"`
	CondOperator ControlOperator `json:"cond_operator,omitempty"`
	CondValue    string          `json:"cond_value,omitempty"`
	OnBreach     ControlOnBreach `json:"on_breach,omitempty"`
	WorkflowID   string          `json:"workflow_id,omitempty"`
	Severity     ControlSeverity `json:"severity,omitempty"`
	CreatedAt    string          `json:"created_at"`
	LastUpdated  string          `json:"last_updated"`
	Deleted      bool            `json:"deleted"`
}

func (c Control) Enforced() bool {
	return c.Action != ""
}

type ControlAttachment struct {
	ID          string     `json:"id"`
	DraftID     string     `json:"draft_id"`
	ControlCode string     `json:"control_code"`
	TargetType  TargetType `json:"target_type"`
	TargetCode  string     `json:"target_code"`
	CreatedAt   string     `json:"created_at"`
}

const (
	TargetTypeRiskPathway TargetType = "risk_pathway"
	TargetTypeThreat      TargetType = "threat"
	TargetTypeConsequence TargetType = "consequence"
)

func (t TargetType) ValidForControl() bool {
	return t.Valid() || t == TargetTypeRiskPathway || t == TargetTypeThreat || t == TargetTypeConsequence
}
