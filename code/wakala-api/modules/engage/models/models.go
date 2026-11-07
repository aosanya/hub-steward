package models

type Post struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	Title       string   `json:"title"`
	Body        string   `json:"body,omitempty"`
	GroupIDs    []string `json:"group_ids"`
	PostedBy    string   `json:"posted_by,omitempty"`
	PostedAt    string   `json:"posted_at"`
	State       string   `json:"state"`
	StartsAt    string   `json:"starts_at,omitempty"`
	EndsAt      string   `json:"ends_at,omitempty"`
	TimeZone    string   `json:"time_zone,omitempty"`
	Place       string   `json:"place,omitempty"`
	Task        string   `json:"task,omitempty"`
	NeededCount int      `json:"needed_count,omitempty"`
}

type RSVP struct {
	ID            string `json:"id"`
	PostID        string `json:"post_id"`
	ParticipantID string `json:"participant_id"`
	Answer        string `json:"answer"`
	AnsweredAt    string `json:"answered_at"`
}

type Attendance struct {
	ID            string `json:"id"`
	PostID        string `json:"post_id"`
	ParticipantID string `json:"participant_id"`
	CheckedInAt   string `json:"checked_in_at"`
	CheckedInBy   string `json:"checked_in_by,omitempty"`
	Unticked      bool   `json:"unticked"`
}

type Offer struct {
	ID            string `json:"id"`
	PostID        string `json:"post_id"`
	ParticipantID string `json:"participant_id"`
	OfferedAt     string `json:"offered_at"`
}

type Pick struct {
	ID       string `json:"id"`
	PostID   string `json:"post_id"`
	OfferID  string `json:"offer_id"`
	PickedAt string `json:"picked_at"`
	PickedBy string `json:"picked_by,omitempty"`
}

type ReadMarker struct {
	ID            string `json:"id"`
	PostID        string `json:"post_id"`
	ParticipantID string `json:"participant_id"`
	ReadAt        string `json:"read_at"`
}
