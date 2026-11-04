package models

// TargetType identifies which kind of entity a [ValueAttachment] or
// [RuleAttachment] points at. Shared between both — a Value and a Rule
// attach to the same five target types.
type TargetType string

const (
	TargetTypeRole      TargetType = "role"
	TargetTypeGoal      TargetType = "goal"
	TargetTypeObjective TargetType = "objective"
	TargetTypeWorkflow  TargetType = "workflow"
	TargetTypeWorkItem  TargetType = "work_item"
)

// Valid reports whether t is one of the five known target types.
func (t TargetType) Valid() bool {
	switch t {
	case TargetTypeRole, TargetTypeGoal, TargetTypeObjective, TargetTypeWorkflow, TargetTypeWorkItem:
		return true
	default:
		return false
	}
}
