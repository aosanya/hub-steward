package mwanachamaagency

// Every Filter type below narrows its matching List method: each non-empty
// field must match, ANDed together. String fields are case-insensitive
// substring matches (see [likeFilter]) except where noted as exact-match
// (see [eqFilter]) — those name an enum column (Status, Label, SourceType)
// rather than free text.

type GoalFilter struct {
	Code        string `query:"code"`
	Title       string `query:"title"`
	Description string `query:"description"`
}

type ObjectiveFilter struct {
	Code        string `query:"code"`
	Title       string `query:"title"`
	Description string `query:"description"`
}

type WorkflowFilter struct {
	Code        string `query:"code"`
	Name        string `query:"name"`
	Description string `query:"description"`
}

type WorkItemFilter struct {
	Code        string   `query:"code"`
	Title       string   `query:"title"`
	Description string   `query:"description"`
	RoleIDs     []string `query:"-"`
}

// DraftFilter's Status is exact-match against [models.DraftStatus]'s
// values ("open", "promoted", "archived").
type DraftFilter struct {
	Description string `query:"description"`
	Status      string `query:"status"`
}

// PublicationFilter's Channel is exact-match on a live channel name
// ("production", "staging", …). "" is the unset filter, not a match on
// archived publications — filter those out of a full listing instead.
type PublicationFilter struct {
	Tag     string `query:"tag"`
	Channel string `query:"channel"`
}

type RecordFilter struct {
	Code       string `query:"code"`
	Name       string `query:"name"`
	WorkflowID string `query:"workflow_id"`
}

type RiskFilter struct {
	Code  string `query:"code"`
	Title string `query:"title"`
}

type RiskPathwayFilter struct {
	RiskID string `query:"risk_id"`
	Side   string `query:"side"`
	Title  string `query:"title"`
}

type MeasureFilter struct {
	ObjectiveID string `query:"objective_id"`
}

type RecordRowFilter struct {
	RecordID   string `query:"record_id"`
	RecordCode string `query:"record_code"`
	OrderID    string `query:"order_id"`
}

type EventFlowStepFilter struct {
	Code        string `query:"code"`
	Name        string `query:"name"`
	Description string `query:"description"`
}

type RoleFilter struct {
	Code        string `query:"code"`
	Name        string `query:"name"`
	Description string `query:"description"`
}

// RoleAssignmentFilter's Label is exact-match against
// [models.RACILabel]'s four values.
type RoleAssignmentFilter struct {
	Label      string `query:"label"`
	WorkItemID string `query:"-"`
	RoleID     string `query:"role_id"`
}

type WorkflowObjectiveFilter struct {
	WorkflowID  string `query:"workflow_id"`
	ObjectiveID string `query:"objective_id"`
}

// ModuleFilter's Code/Name/Description are case-insensitive substring
// matches; Enabled, when non-nil, is an exact match — a *bool rather than
// a bare bool so "not filtering on Enabled" is distinguishable from
// "filtering on Enabled == false".
type ModuleFilter struct {
	Code        string `query:"code"`
	Name        string `query:"name"`
	Description string `query:"description"`
	Enabled     *bool  `query:"enabled"`
}

// ValueFilter's Role/Goal/Objective/Workflow/WorkItem ID fields each
// narrow to Values attached to that specific target (AGD-003) — exact
// match against a resolved id, not a substring search like Code/Text.
// Set more than one and a Value must be attached to every target named,
// not just one of them (same AND-all-fields rule as everything else).
type ValueFilter struct {
	Code        string `query:"code"`
	Text        string `query:"text"`
	RoleID      string `query:"role_id"`
	GoalID      string `query:"goal_id"`
	ObjectiveID string `query:"-"`
	WorkflowID  string `query:"workflow_id"`
	WorkItemID  string `query:"work_item_id"`
}

// RuleFilter's target-id fields work exactly like [ValueFilter]'s.
type RuleFilter struct {
	Code        string `query:"code"`
	Text        string `query:"text"`
	RoleID      string `query:"role_id"`
	GoalID      string `query:"goal_id"`
	ObjectiveID string `query:"-"`
	WorkflowID  string `query:"workflow_id"`
	WorkItemID  string `query:"work_item_id"`
}

// IssueFilter's Severity/EntityType are exact-match against
// [models.IssueSeverity]'s three values / the entity noun ("objective",
// "goal", ...) an Issue points at.
type IssueFilter struct {
	Message    string `query:"message"`
	Severity   string `query:"severity"`
	EntityType string `query:"entity_type"`
}
