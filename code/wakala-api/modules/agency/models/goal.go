package models

// Goal is a strategic objective belonging to an Agency. It omits
// AgencyID (single-agency deployment, no
// cross-agency scoping needed yet).
type Goal struct {
	ID string `json:"id"`
	// Code is a stable, human-readable identifier (e.g. "G-1") assigned
	// once at creation. It never changes — not when Title is edited, and
	// not across a Draft fork→promote cycle, even though promotion mints
	// a brand-new ID for the promoted row.
	Code string `json:"code"`
	// DraftID is "" for a live Goal, or the owning Draft's ID for a
	// draft-scoped copy.
	DraftID     string `json:"draft_id,omitempty"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Ordinality  int    `json:"ordinality"`
	CreatedAt   string `json:"created_at"`
	LastUpdated string `json:"last_updated"`
	Deleted     bool   `json:"deleted"`
}
