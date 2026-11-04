package models

// RuleAttachment links a Rule to one target — a Role, Goal, Objective,
// Workflow, or WorkItem. Same shape, addressing (by Code, not row id),
// and live-editable behavior as [ValueAttachment] — see its doc comment.
// AGD-003 (2026-09-15).
type RuleAttachment struct {
	ID         string     `json:"id"`
	RuleCode   string     `json:"rule_code"`
	TargetType TargetType `json:"target_type"`
	TargetCode string     `json:"target_code"`
	CreatedAt  string     `json:"created_at"`
}
