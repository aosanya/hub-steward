package models

// Agency is the root of the declarative document this package models: the
// Goals/Objectives and Workflows/WorkItems recording how the Agency
// intends to operate. Mission/Vision were
// dropped 2026-09-10 (AGD-001) — confirmed with the user that Values/Rules
// (see [Value], [Rule]) do the job they were meant to, and better, since
// they're explicit enough for an AI agent acting as a Role to read
// directly. Description was added back 2026-09-11, at the user's explicit
// request, as a short plain-text summary of the Agency itself — distinct
// from Mission/Vision's removal, which stays in effect.
type Agency struct {
	ID                           string `json:"id"`
	Name                         string `json:"name"`
	Description                  string `json:"description,omitempty"`
	Enabled                      bool   `json:"enabled"`
	DefaultFailurePipelineBudget int    `json:"default_failure_pipeline_budget"`
	InactivityTimeoutSeconds     int    `json:"inactivity_timeout_seconds"`
	// EventFlows is a raw JSON blob, kept as-is —
	// Workflow.EventFlows falls back to this value when its own is empty.
	EventFlows  string `json:"event_flows,omitempty"`
	CreatedAt   string `json:"created_at"`
	LastUpdated string `json:"last_updated"`
	Deleted     bool   `json:"deleted"`
}
