package models

// DraftStatus is a Draft's position in its edit lifecycle.
type DraftStatus string

const (
	DraftStatusOpen     DraftStatus = "open"
	DraftStatusArchived DraftStatus = "archived"
)

// CanTransitionTo reports whether next is a legal transition from s. Open
// is the only non-terminal status: it can be archived. There is no
// "promoted" status (AGD-006 — publishing reads a Draft's rows directly,
// it never merges them anywhere) — archived is terminal.
func (s DraftStatus) CanTransitionTo(next DraftStatus) bool {
	return s == DraftStatusOpen && next == DraftStatusArchived
}

// Draft is a header/pointer entity for an in-progress edit of an Agency's
// sub-graph — it does not itself carry a copy of that sub-graph. It omits AgencyID (single-agency
// deployment, no cross-agency scoping needed yet).
type Draft struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	// ForkedFromID is another Draft.ID when ForkedFromType is "draft", or
	// a publication Tag when it is "publication" (AGD-006 — there is no
	// "live" fork source; a brand-new Instance is provisioned with one
	// empty Draft directly, never via a fork).
	ForkedFromID   string      `json:"forked_from_id"`
	ForkedFromType string      `json:"forked_from_type"`
	Status         DraftStatus `json:"status"`
	CreatedAt      string      `json:"created_at"`
	LastUpdated    string      `json:"last_updated"`
	Deleted        bool        `json:"deleted"`
}
