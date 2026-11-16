package models

type Resolution struct {
	ID         string `json:"id"`
	InstanceID string `json:"instance_id"`
	MeetingID  string `json:"meeting_id"`
	Title      string `json:"title"`
	Date       string `json:"date"`
	Outcome    string `json:"outcome"`
	CreatedAt  string `json:"created_at"`
}
