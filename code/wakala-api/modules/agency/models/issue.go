package models

// IssueSeverity classifies an Issue's severity.
type IssueSeverity string

const (
	IssueSeverityInfo    IssueSeverity = "info"
	IssueSeverityWarning IssueSeverity = "warning"
	IssueSeverityError   IssueSeverity = "error"
)

// Valid reports whether s is one of the three defined severities.
func (s IssueSeverity) Valid() bool {
	switch s {
	case IssueSeverityInfo, IssueSeverityWarning, IssueSeverityError:
		return true
	default:
		return false
	}
}

// Issue is a system-detected problem found while scanning a Draft — e.g. a
// Workflow with no Objective, or a Goal with no Objectives. Net
// new, added 2026-09-14 (AG20).
//
// Always Draft-scoped (DraftID is required; an Issue never exists against
// the live Agency) and always regenerated:
// [AgencyManager.ListIssues] deletes the Draft's existing Issue rows and
// re-runs every check before returning, so there is no Create/Update/
// Delete surface — nothing here is ever authored directly.
//
// EntityType/EntityID point at the specific Goal/Objective/Role/etc. the
// Issue is about ("" if it isn't about one specific entity), so a caller
// can deep-link to what's wrong.
type Issue struct {
	ID         string        `json:"id"`
	DraftID    string        `json:"draft_id"`
	Severity   IssueSeverity `json:"severity"`
	Message    string        `json:"message"`
	EntityType string        `json:"entity_type,omitempty"`
	EntityID   string        `json:"entity_id,omitempty"`
	CreatedAt  string        `json:"created_at"`
}
