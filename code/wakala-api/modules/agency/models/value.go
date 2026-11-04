package models

// Value is a cultural/strategic statement an AI agent acting as a Role
// needs made explicit — the kind of thing a human Role-holder would just
// treat as common knowledge (e.g. "we prioritize correctness over
// speed"). Plain text, informational only — nothing in this package
// enforces it. Net new, added 2026-09-10 (AGD-001), replacing Agency's
// former Mission/Vision fields.
//
// A Value with no [ValueAttachment]s is Agency-wide. Attaching a Role/
// Goal/Objective/Workflow/WorkItem (AGD-003, 2026-09-15) scopes it to
// that target — a single Value may carry more than one attachment at
// once (e.g. the same Value attached to two Roles). Agency-wide Values
// are set once (at Agency creation/seed time) and have no edit path at
// all, ever: [CreateDraft] deliberately never forks a Value with zero
// attachments (see draft_impl.go), so its DraftID stays "" for the
// Agency's whole lifetime. A Value carrying at least one attachment
// follows Role's stricter live-immutability rule instead — fork a
// Draft, edit the copy, promote — for its Text; attaching/detaching a
// target, by contrast, is live-editable and never goes through the
// Draft cycle (AGD-003 decision #3). Write authorization (only a
// target's Accountable may write its Values/Rules) is not implemented
// here — flagged in AGD-001 as new machinery needing its own design, not
// built in this pass.
type Value struct {
	ID string `json:"id"`
	// Code is a stable, human-readable identifier (e.g. "V-1") assigned
	// once at creation and never changed — see [Goal.Code]'s doc comment.
	Code string `json:"code"`
	// DraftID is "" for a live Value, or the owning Draft's ID for a
	// draft-scoped copy.
	DraftID     string `json:"draft_id,omitempty"`
	Text        string `json:"text"`
	CreatedAt   string `json:"created_at"`
	LastUpdated string `json:"last_updated"`
	Deleted     bool   `json:"deleted"`
}
