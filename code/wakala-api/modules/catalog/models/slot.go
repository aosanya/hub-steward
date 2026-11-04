package models

type Slot struct {
	ID        string `json:"id"`
	SubjectID string `json:"subject_id"`
	StartsAt  string `json:"starts_at"`
	EndsAt    string `json:"ends_at"`
	Capacity  int    `json:"capacity"`
	CreatedAt string `json:"created_at"`
}

type Booking struct {
	ID           string `json:"id"`
	SlotID       string `json:"slot_id"`
	SubjectID    string `json:"subject_id"`
	HolderID     string `json:"holder_id"`
	Day          string `json:"day"`
	StartsAt     string `json:"starts_at"`
	CancelledAt  string `json:"cancelled_at"`
	CancelledBy  string `json:"cancelled_by"`
	CancelReason string `json:"cancel_reason"`
	CreatedAt    string `json:"created_at"`
}
